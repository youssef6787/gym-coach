const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { openAsBlob } = fs;

const cloudinary =
  require("cloudinary").v2;

const {
  NODE_ENV,
  isProduction,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = require("./env");

/*
============================================================
CLOUDINARY CONFIGURATION
============================================================
*/



const cloudinaryEnabled =
  Boolean(
    CLOUDINARY_CLOUD_NAME &&
      CLOUDINARY_API_KEY &&
      CLOUDINARY_API_SECRET
  );

if (
  isProduction &&
  !cloudinaryEnabled
) {
  throw new Error(
    "Cloudinary storage must be configured in production."
  );
}

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name:
      CLOUDINARY_CLOUD_NAME,
    api_key:
      CLOUDINARY_API_KEY,
    api_secret:
      CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/*
============================================================
ALLOWED VALUES
============================================================
*/

const ALLOWED_RESOURCE_TYPES = [
  "image",
  "video",
  "raw",
];

const ALLOWED_DELIVERY_TYPES = [
  "upload",
  "authenticated",
  "private",
];

/*
============================================================
HELPERS
============================================================
*/

const sha1 = (value) =>
  crypto
    .createHash("sha1")
    .update(String(value))
    .digest("hex");

const isAllowedResourceType = (
  value
) =>
  ALLOWED_RESOURCE_TYPES.includes(
    value
  );

const isAllowedDeliveryType = (
  value
) =>
  ALLOWED_DELIVERY_TYPES.includes(
    value
  );

const signParams = (
  params
) => {
  if (!cloudinaryEnabled) {
    throw new Error(
      "Cloudinary is not configured."
    );
  }

  const serialized =
    Object.entries(params)
      .filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== ""
      )
      .sort(
        ([a], [b]) =>
          a.localeCompare(b)
      )
      .map(
        ([key, value]) =>
          `${key}=${value}`
      )
      .join("&");

  return sha1(
    `${serialized}${CLOUDINARY_API_SECRET}`
  );
};

/*
============================================================
UPLOAD
============================================================
*/

const uploadToCloudinary =
  async (
    filePath,
    {
      resourceType,
      folder,
      deliveryType = "upload",
    }
  ) => {
    if (!cloudinaryEnabled) {
      throw new Error(
        "Cloudinary storage is not configured."
      );
    }

    if (
      !isAllowedResourceType(
        resourceType
      )
    ) {
      throw new Error(
        "Invalid Cloudinary resource type."
      );
    }

    if (
      !isAllowedDeliveryType(
        deliveryType
      )
    ) {
      throw new Error(
        "Invalid Cloudinary delivery type."
      );
    }

    if (
      !filePath ||
      !fs.existsSync(filePath)
    ) {
      throw new Error(
        "Uploaded file was not found."
      );
    }

    const timestamp =
      Math.floor(
        Date.now() / 1000
      );

    const params = {
      folder,
      timestamp,
    };

    if (
      deliveryType !==
      "upload"
    ) {
      params.type =
        deliveryType;
    }

    const signature =
      signParams(params);

    const filename =
      path.basename(filePath);

    const form =
      new FormData();

    const fileBlob =
      typeof openAsBlob ===
      "function"
        ? await openAsBlob(
            filePath
          )
        : new Blob([
            fs.readFileSync(
              filePath
            ),
          ]);

    form.append(
      "file",
      fileBlob,
      filename
    );

    form.append(
      "api_key",
      CLOUDINARY_API_KEY
    );

    form.append(
      "timestamp",
      String(timestamp)
    );

    form.append(
      "folder",
      folder
    );

    if (
      deliveryType !==
      "upload"
    ) {
      form.append(
        "type",
        deliveryType
      );
    }

    form.append(
      "signature",
      signature
    );

    const endpoint =
      `https://api.cloudinary.com/v1_1/` +
      `${encodeURIComponent(
        CLOUDINARY_CLOUD_NAME
      )}/` +
      `${resourceType}/upload`;

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",
          body: form,
          signal:
            AbortSignal.timeout(
              120000
            ),
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      !data.secure_url
    ) {
      throw new Error(
        data.error?.message ||
          "Cloudinary upload failed."
      );
    }

    return {
      url:
        data.secure_url,

      publicId:
        data.public_id,

      resourceType:
        data.resource_type,

      deliveryType:
        data.type ||
        deliveryType,

      version:
        data.version ||
        null,

      format:
        data.format ||
        null,

      width:
        data.width ||
        null,

      height:
        data.height ||
        null,

      duration:
        data.duration ||
        null,
    };
  };

/*
============================================================
DESTROY
============================================================
*/

const destroyFromCloudinary =
  async (
    publicId,
    resourceType = "image",
    deliveryType = "upload"
  ) => {
    if (
      !cloudinaryEnabled ||
      !publicId
    ) {
      return;
    }

    if (
      !isAllowedResourceType(
        resourceType
      )
    ) {
      throw new Error(
        "Invalid Cloudinary resource type."
      );
    }

    if (
      !isAllowedDeliveryType(
        deliveryType
      )
    ) {
      throw new Error(
        "Invalid Cloudinary delivery type."
      );
    }

    const timestamp =
      Math.floor(
        Date.now() / 1000
      );

    const params = {
      public_id:
        publicId,
      timestamp,
      type:
        deliveryType,
    };

    const signature =
      signParams(params);

    const form =
      new URLSearchParams();

    form.set(
      "public_id",
      publicId
    );

    form.set(
      "timestamp",
      String(timestamp)
    );

    form.set(
      "api_key",
      CLOUDINARY_API_KEY
    );

    form.set(
      "type",
      deliveryType
    );

    form.set(
      "signature",
      signature
    );

    const endpoint =
      `https://api.cloudinary.com/v1_1/` +
      `${encodeURIComponent(
        CLOUDINARY_CLOUD_NAME
      )}/` +
      `${resourceType}/destroy`;

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/x-www-form-urlencoded",
          },

          body: form,

          signal:
            AbortSignal.timeout(
              120000
            ),
        }
      );

    if (!response.ok) {
      const data =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        data.error?.message ||
          "Cloudinary delete failed."
      );
    }
  };

/*
============================================================
PARSE CLOUDINARY URL
============================================================

مهم جدًا:
authenticated URLs قد تحتوي على:

/s--signature--/

داخل المسار.

يجب تجاهل جزء التوقيع وعدم اعتباره publicId.
============================================================
*/

const parseCloudinaryUrl =
  (url) => {
    if (
      !url ||
      !url.includes(
        "res.cloudinary.com/"
      )
    ) {
      return null;
    }

    try {
      const parsed =
        new URL(url);

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      const resourceIndex =
        parts.findIndex(
          (part) =>
            [
              "image",
              "video",
              "raw",
            ].includes(part)
        );

      if (
        resourceIndex === -1
      ) {
        return null;
      }

      const resourceType =
        parts[resourceIndex];

      const deliveryType =
        parts[
          resourceIndex + 1
        ];

      if (
        !isAllowedDeliveryType(
          deliveryType
        )
      ) {
        return null;
      }

      let rest =
        parts.slice(
          resourceIndex + 2
        );

      if (!rest.length) {
        return null;
      }

      /*
      authenticated signed URL:

      /authenticated/s--SIGNATURE--/v123/folder/file.mp4

      نحذف signature segment.
      */

      if (
        deliveryType ===
          "authenticated" &&
        /^s--[^/]+--$/.test(
          rest[0]
        )
      ) {
        rest = rest.slice(1);
      }

      if (!rest.length) {
        return null;
      }

      let version = null;

      if (
        /^v\d+$/.test(
          rest[0]
        )
      ) {
        version =
          rest[0].substring(1);

        rest = rest.slice(1);
      }

      if (!rest.length) {
        return null;
      }

      const last =
        rest[rest.length - 1];

      const extensionMatch =
        last.match(
          /\.([^.]+)$/
        );

      const extension =
        extensionMatch
          ? extensionMatch[1]
          : null;

      const cleanRest = [
        ...rest,
      ];

      if (extensionMatch) {
        cleanRest[
          cleanRest.length - 1
        ] =
          last.slice(
            0,
            -(
              extension.length +
              1
            )
          );
      }

      const publicId =
        cleanRest.join("/");

      if (!publicId) {
        return null;
      }

      return {
        cloudName:
          parsed.hostname.split(
            "."
          )[0],

        resourceType,

        deliveryType,

        version,

        publicId,

        extension,

        originalUrl:
          url,
      };
    } catch {
      return null;
    }
  };

/*
============================================================
PUBLIC ID
============================================================
*/

const publicIdFromUrl =
  (url) =>
    parseCloudinaryUrl(
      url
    )?.publicId || null;

/*
============================================================
DELIVERY TYPE
============================================================
*/

const deliveryTypeFromUrl =
  (url) =>
    parseCloudinaryUrl(
      url
    )?.deliveryType || null;

/*
============================================================
SIGNED AUTHENTICATED URL
============================================================
*/

const signedCloudinaryUrl =
  (url) => {
    const parsed =
      parseCloudinaryUrl(
        url
      );

    if (!parsed) {
      return null;
    }

    if (
      parsed.deliveryType !==
      "authenticated"
    ) {
      return null;
    }

    if (!cloudinaryEnabled) {
      throw new Error(
        "Cloudinary is not configured."
      );
    }

    /*
    إعادة توليد الرابط من
    publicId الحقيقي فقط.
    */

    const options = {
      resource_type:
        parsed.resourceType,

      type:
        "authenticated",

      secure:
        true,

      sign_url:
        true,
    };

    /*
    لا نرسل format في رابط الفيديو
    حتى لا نغير resource identifier.
    Cloudinary يعرف صيغة الملف من الأصل.
    */

    if (
      parsed.version
    ) {
      options.version =
        Number(
          parsed.version
        );
    }

    return cloudinary.url(
      parsed.publicId,
      options
    );
  };

/*
============================================================
PROTECTED MEDIA URL
============================================================
*/

const getProtectedMediaUrl =
  (url) => {
    if (!url) {
      return null;
    }

    if (
      url.startsWith(
        "/uploads/"
      )
    ) {
      return url;
    }

    const parsed =
      parseCloudinaryUrl(
        url
      );

    if (!parsed) {
      return null;
    }

    if (
      parsed.deliveryType !==
      "authenticated"
    ) {
      return null;
    }

    return signedCloudinaryUrl(
      url
    );
  };

/*
============================================================
RENAME TO AUTHENTICATED
============================================================
*/

const renameToAuthenticated =
  async (url) => {
    if (!cloudinaryEnabled) {
      throw new Error(
        "Cloudinary storage is not configured."
      );
    }

    const parsed =
      parseCloudinaryUrl(
        url
      );

    if (!parsed) {
      throw new Error(
        "Invalid Cloudinary URL."
      );
    }

    if (
      parsed.deliveryType ===
      "authenticated"
    ) {
      return signedCloudinaryUrl(
        url
      );
    }

    const timestamp =
      Math.floor(
        Date.now() / 1000
      );

    const params = {
      from_public_id:
        parsed.publicId,

      to_public_id:
        parsed.publicId,

      to_type:
        "authenticated",

      type:
        parsed.deliveryType ||
        "upload",

      overwrite:
        "true",

      invalidate:
        "true",

      timestamp,
    };

    const signature =
      signParams(params);

    const form =
      new URLSearchParams();

    for (
      const [
        key,
        value,
      ] of Object.entries(
        params
      )
    ) {
      form.set(
        key,
        String(value)
      );
    }

    form.set(
      "api_key",
      CLOUDINARY_API_KEY
    );

    form.set(
      "signature",
      signature
    );

    const endpoint =
      `https://api.cloudinary.com/v1_1/` +
      `${encodeURIComponent(
        CLOUDINARY_CLOUD_NAME
      )}/` +
      `${parsed.resourceType}/rename`;

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/x-www-form-urlencoded",
          },

          body: form,

          signal:
            AbortSignal.timeout(
              120000
            ),
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
          "Cloudinary asset conversion failed."
      );
    }

    return (
      data.secure_url ||
      signedCloudinaryUrl(
        buildCanonicalCloudinaryUrl({
          resourceType:
            parsed.resourceType,

          deliveryType:
            "authenticated",

          publicId:
            data.public_id ||
            parsed.publicId,

          version:
            data.version ||
            parsed.version,

          format:
            data.format ||
            parsed.extension,
        })
      )
    );
  };

/*
============================================================
BUILD CLOUDINARY URL
============================================================
*/

const buildCanonicalCloudinaryUrl =
  ({
    resourceType,
    deliveryType =
      "upload",
    publicId,
    version,
    format,
  }) => {
    if (
      !cloudinaryEnabled ||
      !publicId
    ) {
      return null;
    }

    if (
      !isAllowedResourceType(
        resourceType
      )
    ) {
      return null;
    }

    if (
      !isAllowedDeliveryType(
        deliveryType
      )
    ) {
      return null;
    }

    const extension =
      format
        ? `.${String(
            format
          ).replace(
            /^\./,
            ""
          )}`
        : "";

    const versionPart =
      version
        ? `/v${version}`
        : "";

    return (
      `https://res.cloudinary.com/` +
      `${encodeURIComponent(
        CLOUDINARY_CLOUD_NAME
      )}/` +
      `${resourceType}/` +
      `${deliveryType}` +
      `${versionPart}/` +
      `${publicId}` +
      `${extension}`
    );
  };

/*
============================================================
REMOVE LOCAL FILE
============================================================
*/

const removeLocalFile =
  (filePath) => {
    if (
      !filePath ||
      !fs.existsSync(
        filePath
      )
    ) {
      return;
    }

    try {
      fs.unlinkSync(
        filePath
      );
    } catch {
      // ignore cleanup errors
    }
  };

/*
============================================================
STORE UPLOADED FILE
============================================================
*/

const storeUploadedFile =
  async (
    file,
    {
      resourceType,
      folder,
      localUrl,
      deliveryType =
        "upload",
    }
  ) => {
    if (!file) {
      throw new Error(
        "No file supplied."
      );
    }

    if (
      !isAllowedResourceType(
        resourceType
      )
    ) {
      removeLocalFile(
        file.path
      );

      throw new Error(
        "Invalid resource type."
      );
    }

    if (
      !isAllowedDeliveryType(
        deliveryType
      )
    ) {
      removeLocalFile(
        file.path
      );

      throw new Error(
        "Invalid delivery type."
      );
    }

    if (
      isProduction &&
      !cloudinaryEnabled
    ) {
      removeLocalFile(
        file.path
      );

      throw new Error(
        "Cloudinary storage is required in production."
      );
    }

    if (
      cloudinaryEnabled
    ) {
      try {
        const uploaded =
          await uploadToCloudinary(
            file.path,
            {
              resourceType,
              folder,
              deliveryType,
            }
          );

        removeLocalFile(
          file.path
        );

        return uploaded;
      } catch (error) {
        removeLocalFile(
          file.path
        );

        throw error;
      }
    }

    return {
      url:
        localUrl,

      publicId:
        null,

      resourceType,

      deliveryType:
        "local",
    };
  };

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {
  cloudinaryEnabled,

  uploadToCloudinary,

  destroyFromCloudinary,

  publicIdFromUrl,

  deliveryTypeFromUrl,

  parseCloudinaryUrl,

  signedCloudinaryUrl,

  getProtectedMediaUrl,

  renameToAuthenticated,

  buildCanonicalCloudinaryUrl,

  removeLocalFile,

  storeUploadedFile,
};