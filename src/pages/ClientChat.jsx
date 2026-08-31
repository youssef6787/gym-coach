import API_URL from "../config/api";
import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import "./ClientChat.css";

const IMAGE_MAX_SIZE =
  5 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const getUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem(
        "user"
      ) || "{}"
    );
  } catch {
    return {};
  }
};

const getImageUrl = (url) => {
  if (!url) {
    return "";
  }

  return url.startsWith("http")
    ? url
    : `${API_URL}${url}`;
};

const formatTime = (value) => {
  const date = new Date(
    value
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "ar-EG",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

function ClientChat() {
  const [messages, setMessages] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [coach, setCoach] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [
    uploadingImage,
    setUploadingImage,
  ] = useState(false);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState(null);

  const [
    imagePreview,
    setImagePreview,
  ] = useState("");

  const [
    lightboxImage,
    setLightboxImage,
  ] = useState(null);

  const [
    protectedMediaUrls,
    setProtectedMediaUrls,
  ] = useState({});

  const messagesEndRef =
    useRef(null);

  const imageInputRef =
    useRef(null);

  const token =
    localStorage.getItem(
      "token"
    );

  const currentUser =
    getUser();

  /*
  =====================================================
  GET COACH
  =====================================================
  */

  const getCoach = async () => {
    try {
      const response =
        await fetch(
          `${API_URL}/chat/coach`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "تعذر تحميل المدرب"
        );
      }

      setCoach(
        data.coach || null
      );
    } catch {
      setCoach(null);
    }
  };

  /*
  =====================================================
  GET MESSAGES
  =====================================================
  */

  const getMessages = async (
    silent = false
  ) => {
    if (!coach?.id) {
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }

      const response =
        await fetch(
          `${API_URL}/chat/${coach.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setMessages(
          Array.isArray(
            data.messages
          )
            ? data.messages
            : []
        );
      }
    } catch {
      /*
      لا يتم تسجيل أخطاء polling
      المتكررة في Console في Production.
      */
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  /*
  =====================================================
  LOAD PROTECTED IMAGES
  =====================================================
  */

  useEffect(() => {
    let cancelled = false;

    async function loadProtectedImages() {
      if (
        !token ||
        !messages.length
      ) {
        setProtectedMediaUrls(
          {}
        );

        return;
      }

      const imageMessages =
        messages.filter(
          (item) =>
            (
              item.message_type ===
                "image" ||
              item.media_url
            ) &&
            item.media_url
        );

      const entries =
        await Promise.all(
          imageMessages.map(
            async (item) => {
              if (
                protectedMediaUrls[
                  item.id
                ]
              ) {
                return [
                  String(
                    item.id
                  ),
                  protectedMediaUrls[
                    item.id
                  ],
                ];
              }

              try {
                const endpoint =
                  item.media_url.startsWith(
                    "http"
                  )
                    ? item.media_url
                    : `${API_URL}${item.media_url}`;

                const response =
                  await fetch(
                    endpoint,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );

                const data =
                  await response
                    .json()
                    .catch(
                      () => ({})
                    );

                return response.ok &&
                  data.success &&
                  data.url
                  ? [
                      String(
                        item.id
                      ),
                      data.url,
                    ]
                  : null;
              } catch {
                return null;
              }
            }
          )
        );

      if (cancelled) {
        return;
      }

      setProtectedMediaUrls(
        (current) => ({
          ...current,
          ...Object.fromEntries(
            entries.filter(
              Boolean
            )
          ),
        })
      );
    }

    loadProtectedImages();

    return () => {
      cancelled = true;
    };
  }, [
    messages,
    token,
  ]);

  /*
  =====================================================
  INITIAL COACH LOAD
  =====================================================
  */

  useEffect(() => {
    getCoach();
  }, []);

  /*
  =====================================================
  CHAT POLLING
  =====================================================
  */

  useEffect(() => {
    if (!coach?.id) {
      return undefined;
    }

    getMessages();

    const interval =
      window.setInterval(
        () => {
          getMessages(true);
        },
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [coach]);

  /*
  =====================================================
  SCROLL TO LAST MESSAGE
  =====================================================
  */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }, [messages]);

  /*
  =====================================================
  IMAGE PREVIEW CLEANUP
  =====================================================
  */

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [imagePreview]);

  /*
  =====================================================
  ESC CLOSE LIGHTBOX
  =====================================================
  */

  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          closeImage();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);

  /*
  =====================================================
  OPEN IMAGE
  =====================================================
  */

  const openImage = (url) => {
    const imageUrl =
      getImageUrl(url);

    if (imageUrl) {
      setLightboxImage(
        imageUrl
      );
    }
  };

  /*
  =====================================================
  CLOSE IMAGE
  =====================================================
  */

  const closeImage = () => {
    setLightboxImage(null);
  };

  /*
  =====================================================
  DOWNLOAD IMAGE
  =====================================================
  */

  const downloadImage =
    async (url) => {
      const imageUrl =
        getImageUrl(url);

      if (!imageUrl) {
        return;
      }

      try {
        const response =
          await fetch(
            imageUrl
          );

        if (!response.ok) {
          throw new Error(
            "تعذر تنزيل الصورة"
          );
        }

        const blob =
          await response.blob();

        const blobUrl =
          URL.createObjectURL(
            blob
          );

        const extension =
          blob.type.split(
            "/"
          )[1] || "jpg";

        const anchor =
          document.createElement(
            "a"
          );

        anchor.href =
          blobUrl;

        anchor.download =
          `chat-image-${Date.now()}.${extension}`;

        document.body.appendChild(
          anchor
        );

        anchor.click();

        anchor.remove();

        setTimeout(
          () =>
            URL.revokeObjectURL(
              blobUrl
            ),
          1000
        );
      } catch {
        alert(
          "تعذر تنزيل الصورة، حاول مرة أخرى"
        );
      }
    };

  /*
  =====================================================
  CLEAR IMAGE
  =====================================================
  */

  const clearImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setImagePreview("");

    setSelectedImage(
      null
    );

    if (
      imageInputRef.current
    ) {
      imageInputRef.current.value =
        "";
    }
  };

  /*
  =====================================================
  IMAGE CHANGE
  =====================================================
  */

  const handleImageChange =
    (event) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      if (
        !IMAGE_TYPES.includes(
          file.type
        )
      ) {
        alert(
          "يسمح فقط بصور JPG أو PNG أو WEBP"
        );

        event.target.value =
          "";

        return;
      }

      if (
        file.size >
        IMAGE_MAX_SIZE
      ) {
        alert(
          "حجم الصورة يجب ألا يتجاوز 5MB"
        );

        event.target.value =
          "";

        return;
      }

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      setSelectedImage(
        file
      );

      setImagePreview(
        URL.createObjectURL(
          file
        )
      );
    };

  /*
  =====================================================
  SEND TEXT MESSAGE
  =====================================================
  */

  const sendTextMessage =
    async () => {
      const text =
        message.trim();

      if (
        !text ||
        !coach?.id
      ) {
        return;
      }

      const response =
        await fetch(
          `${API_URL}/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify(
              {
                receiver_id:
                  coach.id,

                message:
                  text,
              }
            ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "حدث خطأ أثناء إرسال الرسالة"
        );
      }

      setMessages(
        (prev) => [
          ...prev,
          data.data,
        ]
      );

      setMessage("");
    };

  /*
  =====================================================
  SEND IMAGE
  =====================================================
  */

  const sendImage =
    async () => {
      if (
        !selectedImage ||
        !coach?.id
      ) {
        return;
      }

      try {
        setUploadingImage(
          true
        );

        const formData =
          new FormData();

        formData.append(
          "receiver_id",
          String(
            coach.id
          )
        );

        formData.append(
          "image",
          selectedImage
        );

        const response =
          await fetch(
            `${API_URL}/chat/image`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "حدث خطأ أثناء إرسال الصورة"
          );
        }

        setMessages(
          (prev) => [
            ...prev,
            data.data,
          ]
        );

        clearImage();
      } finally {
        setUploadingImage(
          false
        );
      }
    };

  /*
  =====================================================
  SEND MESSAGE
  =====================================================
  */

  const sendMessage =
    async (event) => {
      event.preventDefault();

      if (
        !coach?.id ||
        sending ||
        uploadingImage
      ) {
        return;
      }

      try {
        setSending(true);

        if (
          message.trim()
        ) {
          await sendTextMessage();
        }

        if (
          selectedImage
        ) {
          await sendImage();
        }
      } catch (error) {
        alert(
          error.message ||
            "حدث خطأ أثناء إرسال الرسالة"
        );
      } finally {
        setSending(false);
      }
    };

  /*
  =====================================================
  LOADING
  =====================================================
  */

  if (loading) {
    return (
      <div
        className="client-chat-page"
        dir="rtl"
      >
        <div className="client-chat-loading">
          جاري تحميل المحادثة...
        </div>
      </div>
    );
  }

  /*
  =====================================================
  NO COACH
  =====================================================
  */

  if (!coach) {
    return (
      <div
        className="client-chat-page"
        dir="rtl"
      >
        <div className="client-chat-empty">

          <div className="client-chat-empty-icon">
            ●
          </div>

          <h2>
            لا يوجد مدرب متاح
          </h2>

          <p>
            لم يتم العثور على مدرب
            مرتبط بحسابك حاليًا.
          </p>

        </div>
      </div>
    );
  }

  /*
  =====================================================
  RENDER
  =====================================================
  */

  return (
    <div
      className="client-chat-page"
      dir="rtl"
    >
      <header className="client-chat-header">

        <div className="client-chat-avatar">

          <span>
            {coach.name?.charAt(
              0
            ) || "M"}
          </span>

          <i />

        </div>

        <div>

          <span className="client-chat-label">
            GYM COACH / CHAT
          </span>

          <h1>
            الدردشة مع المدرب
          </h1>

          <p>
            {coach.name} • متاح للمراسلة
          </p>

        </div>

      </header>


      {/* =================================================
          Messages
      ================================================= */}

      <section className="client-chat-messages">

        {messages.length ===
        0 ? (

          <div className="client-chat-no-messages">

            <div className="chat-empty-icon">
              ●
            </div>

            <h2>
              ابدأ المحادثة
            </h2>

            <p>
              أرسل رسالة أو صورة
              إلى مدربك الآن.
            </p>

          </div>

        ) : (

          messages.map(
            (item) => {
              const isMine =
                Number(
                  item.sender_id
                ) ===
                Number(
                  currentUser.id
                );

              const hasImage =
                item.message_type ===
                  "image" ||
                item.image_url;

              return (
                <div
                  key={
                    item.id
                  }
                  className={`client-chat-message ${
                    isMine
                      ? "mine"
                      : ""
                  }`}
                >

                  <div className="client-chat-bubble">

                    {hasImage && (
                      <button
                        type="button"
                        className="chat-message-image-button"
                        onClick={() =>
                          openImage(
                            protectedMediaUrls[
                              item.id
                            ]
                          )
                        }
                        title="فتح الصورة بالحجم الكامل"
                      >

                        <img
                          className="chat-message-image"
                          src={
                            protectedMediaUrls[
                              item.id
                            ] || ""
                          }
                          alt="صورة مرسلة في المحادثة"
                        />

                      </button>
                    )}

                    {item.message && (
                      <p>
                        {
                          item.message
                        }
                      </p>
                    )}

                    <span>
                      {formatTime(
                        item.created_at
                      )}
                    </span>

                  </div>

                </div>
              );
            }
          )

        )}

        <div
          ref={
            messagesEndRef
          }
        />

      </section>


      {/* =================================================
          Image Preview
      ================================================= */}

      {imagePreview && (
        <div className="chat-image-preview-row client-preview">

          <div>

            <img
              src={
                imagePreview
              }
              alt="معاينة"
            />

            <span>
              {
                selectedImage?.name
              }
            </span>

          </div>

          <button
            type="button"
            onClick={
              clearImage
            }
          >
            ×
          </button>

        </div>
      )}


      {/* =================================================
          Send Form
      ================================================= */}

      <form
        className="client-chat-form"
        onSubmit={
          sendMessage
        }
      >

        <button
          type="button"
          className="chat-attach-button"
          onClick={() =>
            imageInputRef.current?.click()
          }
          title="إرسال صورة"
        >

          <span>
            ▧
          </span>

          <small>
            صورة
          </small>

        </button>

        <input
          ref={
            imageInputRef
          }
          className="chat-hidden-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={
            handleImageChange
          }
        />

        <input
          type="text"
          value={
            message
          }
          onChange={(event) =>
            setMessage(
              event.target.value
            )
          }
          placeholder="اكتب رسالتك للمدرب..."
          disabled={
            sending ||
            uploadingImage
          }
        />

        <button
          className="chat-send-button"
          type="submit"
          disabled={
            sending ||
            uploadingImage ||
            (
              !message.trim() &&
              !selectedImage
            )
          }
        >
          {sending ||
          uploadingImage
            ? "..."
            : "إرسال ➊"}
        </button>

      </form>


      <div className="chat-form-hint">
        يمكنك إرسال الصور بصيغ
        JPG, PNG, WEBP وبحد
        أقصى 5MB • اضغط على أي
        صورة لفتحها كاملة
      </div>


      {/* =================================================
          Lightbox
      ================================================= */}

      {lightboxImage && (
        <div
          className="chat-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="عرض الصورة"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeImage();
            }
          }}
        >

          <div className="chat-image-lightbox-content">

            <button
              type="button"
              className="chat-lightbox-close"
              onClick={
                closeImage
              }
              aria-label="إغلاق"
            >
              ×
            </button>

            <img
              src={
                lightboxImage
              }
              alt="الصورة بالحجم الكامل"
            />

            <div className="chat-lightbox-actions">

              <button
                type="button"
                className="chat-lightbox-download"
                onClick={() =>
                  downloadImage(
                    lightboxImage
                  )
                }
              >
                تنزيل الصورة
              </button>

              <button
                type="button"
                className="chat-lightbox-open"
                onClick={() =>
                  window.open(
                    lightboxImage,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                فتح في تبويب جديد
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default ClientChat;
