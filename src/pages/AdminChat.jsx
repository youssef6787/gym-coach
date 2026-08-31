import API_URL from "../config/api";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import "./AdminChat.css";

const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const getUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
};

const getImageUrl = (url) => {
  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  return `${API_URL}${
    url.startsWith("/") ? "" : "/"
  }${url}`;
};

const formatTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

const getMessageImageSource = (item) =>
  item?.media_url ||
  item?.image_url ||
  "";

const isImageMessage = (item) =>
  Boolean(
    item?.message_type === "image" ||
      item?.media_url ||
      item?.image_url
  );

function AdminChat() {
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const requestedClientId =
    Number(
      searchParams.get("clientId") ||
        searchParams.get("client")
    ) || null;

  const [
    clients,
    setClients,
  ] = useState([]);

  const [
    selectedClient,
    setSelectedClient,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

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
    imageUrls,
    setImageUrls,
  ] = useState({});

  const [
    imageErrors,
    setImageErrors,
  ] = useState({});

  const [
    loadingClients,
    setLoadingClients,
  ] = useState(true);

  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(false);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    uploadingImage,
    setUploadingImage,
  ] = useState(false);

  const [
    unreadByClient,
    setUnreadByClient,
  ] = useState({});

  const messagesEndRef =
    useRef(null);

  const imageInputRef =
    useRef(null);

  const selectedClientRef =
    useRef(null);

  const imageLoadingRef =
    useRef(new Set());

  const imageObjectUrlsRef =
    useRef(new Map());

  const token =
    localStorage.getItem("token") || "";

  const currentUser =
    getUser();

  /*
  =========================================================
  CLEAN IMAGE OBJECT URLS
  =========================================================
  */

  const cleanupImageUrls =
    useCallback(() => {
      imageObjectUrlsRef.current.forEach(
        (url) => {
          if (
            typeof url ===
              "string" &&
            url.startsWith("blob:")
          ) {
            try {
              URL.revokeObjectURL(
                url
              );
            } catch {
              // ignore
            }
          }
        }
      );

      imageObjectUrlsRef.current.clear();
      imageLoadingRef.current.clear();

      setImageUrls({});
      setImageErrors({});
    }, []);

  /*
  =========================================================
  GET CLIENTS
  =========================================================
  */

  const getClients =
    useCallback(async () => {
      try {
        setLoadingClients(true);

        const response =
          await fetch(
            `${API_URL}/clients`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "تعذر تحميل العملاء"
          );
        }

        setClients(
          Array.isArray(
            data.clients
          )
            ? data.clients.filter(
                (user) =>
                  user.role ===
                  "client"
              )
            : []
        );
      } catch {
        setClients([]);
      } finally {
        setLoadingClients(
          false
        );
      }
    }, [token]);

  /*
  =========================================================
  LOAD UNREAD COUNTS BY CLIENT
  =========================================================
  */

  const loadUnreadByClient =
    useCallback(async () => {
      if (
        !token ||
        currentUser?.role !==
          "admin"
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/chat/unread/by-client`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          response.ok &&
          data.success
        ) {
          setUnreadByClient(
            data.counts || {}
          );
        }
      } catch {
        setUnreadByClient({});
      }
    }, [
      token,
      currentUser?.role,
    ]);

  /*
  =========================================================
  MARK CLIENT MESSAGES AS READ
  =========================================================
  */

  const markClientUnreadAsRead =
    useCallback(
      async (clientId) => {
        if (
          !clientId ||
          !token
        ) {
          return;
        }

        try {
          await fetch(
            `${API_URL}/chat/${clientId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

          setUnreadByClient(
            (current) => {
              const next = {
                ...current,
              };

              delete next[
                String(clientId)
              ];

              return next;
            }
          );
        } catch {
          setUnreadByClient(
            (current) => {
              const next = {
                ...current,
              };

              delete next[
                String(clientId)
              ];

              return next;
            }
          );
        }
      },
      [token]
    );

  /*
  =========================================================
  GET MESSAGES
  =========================================================
  */

  const getMessages =
    useCallback(
      async (
        clientId,
        silent = false
      ) => {
        if (
          !clientId ||
          !token
        ) {
          return;
        }

        try {
          if (!silent) {
            setLoadingMessages(
              true
            );
          }

          const response =
            await fetch(
              `${API_URL}/chat/${clientId}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const data =
            await response
              .json()
              .catch(() => ({}));

          if (
            Number(
              selectedClientRef.current
            ) !==
            Number(clientId)
          ) {
            return;
          }

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

            setUnreadByClient(
              (current) => {
                const next = {
                  ...current,
                };

                delete next[
                  String(clientId)
                ];

                return next;
              }
            );
          } else if (
            !silent
          ) {
            setMessages([]);
          }
        } catch {
          if (!silent) {
            setMessages([]);
          }
        } finally {
          if (!silent) {
            setLoadingMessages(
              false
            );
          }
        }
      },
      [token]
    );

  /*
  =========================================================
  INITIAL CLIENT LOAD
  =========================================================
  */

  useEffect(() => {
    getClients();
  }, [getClients]);

  /*
  =========================================================
  UNREAD POLLING
  =========================================================
  */

  useEffect(() => {
    loadUnreadByClient();

    const interval =
      window.setInterval(
        loadUnreadByClient,
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    loadUnreadByClient,
  ]);

  /*
  =========================================================
  OPEN CLIENT FROM NOTIFICATION
  =========================================================
  */

  useEffect(() => {
    if (
      !requestedClientId ||
      !clients.length
    ) {
      return;
    }

    const client =
      clients.find(
        (item) =>
          Number(item.id) ===
          Number(
            requestedClientId
          )
      );

    if (!client) {
      return;
    }

    if (
      Number(
        selectedClient?.id
      ) !==
      Number(client.id)
    ) {
      setSelectedClient(
        client
      );

      selectedClientRef.current =
        client.id;
    }

    setSearchParams(
      {},
      {
        replace: true,
      }
    );
  }, [
    requestedClientId,
    clients,
    selectedClient,
    setSearchParams,
  ]);

  /*
  =========================================================
  SELECTED CLIENT
  =========================================================
  */

  useEffect(() => {
    if (
      !selectedClient?.id
    ) {
      return undefined;
    }

    selectedClientRef.current =
      selectedClient.id;

    cleanupImageUrls();

    setMessages([]);
    setLightboxImage(null);

    setUnreadByClient(
      (current) => {
        const next = {
          ...current,
        };

        delete next[
          String(
            selectedClient.id
          )
        ];

        return next;
      }
    );

    getMessages(
      selectedClient.id
    );

    const interval =
      window.setInterval(
        () =>
          getMessages(
            selectedClient.id,
            true
          ),
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    selectedClient,
    getMessages,
    cleanupImageUrls,
  ]);

  /*
  =========================================================
  PROTECTED IMAGE LOADER
  =========================================================
  */

  const loadProtectedImage =
    useCallback(
      async (item) => {
        const source =
          getMessageImageSource(
            item
          );

        if (
          !item?.id ||
          !source ||
          !token
        ) {
          return "";
        }

        const imageId =
          String(item.id);

        const cached =
          imageObjectUrlsRef.current.get(
            imageId
          );

        if (cached) {
          return cached;
        }

        if (
          imageLoadingRef.current.has(
            imageId
          )
        ) {
          return "";
        }

        imageLoadingRef.current.add(
          imageId
        );

        setImageErrors(
          (current) => {
            const next = {
              ...current,
            };

            delete next[
              imageId
            ];

            return next;
          }
        );

        try {
          const response =
            await fetch(
              getImageUrl(
                source
              ),
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }

          const contentType =
            response.headers.get(
              "content-type"
            ) || "";

          let finalUrl = "";

          if (
            contentType.includes(
              "application/json"
            )
          ) {
            const data =
              await response
                .json()
                .catch(
                  () => null
                );

            const returnedUrl =
              data?.url ||
              data?.media_url ||
              data?.image_url;

            if (
              !returnedUrl
            ) {
              throw new Error(
                "لم يتم الحصول على رابط الصورة"
              );
            }

            finalUrl =
              getImageUrl(
                returnedUrl
              );

            imageObjectUrlsRef.current.set(
              imageId,
              finalUrl
            );
          } else {
            const blob =
              await response.blob();

            if (
              !blob.size
            ) {
              throw new Error(
                "الصورة فارغة"
              );
            }

            finalUrl =
              URL.createObjectURL(
                blob
              );

            imageObjectUrlsRef.current.set(
              imageId,
              finalUrl
            );
          }

          setImageUrls(
            (current) => ({
              ...current,
              [imageId]:
                finalUrl,
            })
          );

          return finalUrl;
        } catch {
          setImageErrors(
            (current) => ({
              ...current,
              [imageId]: true,
            })
          );

          return "";
        } finally {
          imageLoadingRef.current.delete(
            imageId
          );
        }
      },
      [token]
    );

  /*
  =========================================================
  LOAD MESSAGE IMAGES
  =========================================================
  */

  useEffect(() => {
    let cancelled =
      false;

    const imageMessages =
      messages.filter(
        isImageMessage
      );

    const loadImages =
      async () => {
        for (
          const item of imageMessages
        ) {
          if (
            cancelled
          ) {
            return;
          }

          await loadProtectedImage(
            item
          );
        }
      };

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [
    messages,
    loadProtectedImage,
  ]);

  /*
  =========================================================
  AUTO SCROLL
  =========================================================
  */

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          messagesEndRef.current?.scrollIntoView(
            {
              behavior:
                "smooth",
              block: "end",
            }
          );
        },
        40
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [messages]);

  /*
  =========================================================
  ESC
  =========================================================
  */

  useEffect(() => {
    const onKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          setLightboxImage(
            null
          );
        }
      };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, []);

  /*
  =========================================================
  CLEANUP
  =========================================================
  */

  useEffect(() => {
    return () =>
      cleanupImageUrls();
  }, [
    cleanupImageUrls,
  ]);

  useEffect(() => {
    return () => {
      if (
        imagePreview?.startsWith(
          "blob:"
        )
      ) {
        try {
          URL.revokeObjectURL(
            imagePreview
          );
        } catch {
          // ignore
        }
      }
    };
  }, [imagePreview]);

  /*
  =========================================================
  FILTER CLIENTS
  =========================================================
  */

  const filteredClients =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return clients;
      }

      return clients.filter(
        (client) =>
          [
            client.name,
            client.email,
            client.package_name,
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(
                  value
                )
                  .toLowerCase()
                  .includes(
                    query
                  )
            )
      );
    }, [
      clients,
      search,
    ]);

  /*
  =========================================================
  CLEAR SELECTED IMAGE
  =========================================================
  */

  const clearImage =
    () => {
      if (
        imagePreview?.startsWith(
          "blob:"
        )
      ) {
        try {
          URL.revokeObjectURL(
            imagePreview
          );
        } catch {
          // ignore
        }
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
  =========================================================
  IMAGE CHANGE
  =========================================================
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

      if (
        imagePreview?.startsWith(
          "blob:"
        )
      ) {
        try {
          URL.revokeObjectURL(
            imagePreview
          );
        } catch {
          // ignore
        }
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
  =========================================================
  SELECT CLIENT
  =========================================================
  */

  const handleSelectClient =
    (client) => {
      setSelectedClient(
        client
      );

      selectedClientRef.current =
        client.id;

      setMessages([]);

      setLightboxImage(
        null
      );

      cleanupImageUrls();

      clearImage();

      markClientUnreadAsRead(
        client.id
      );
    };

  /*
  =========================================================
  OPEN IMAGE
  =========================================================
  */

  const openImage =
    async (item) => {
      const imageId =
        String(
          item?.id || ""
        );

      if (!imageId) {
        return;
      }

      let url =
        imageUrls[
          imageId
        ] ||
        imageObjectUrlsRef.current.get(
          imageId
        );

      if (!url) {
        url =
          await loadProtectedImage(
            item
          );
      }

      if (!url) {
        alert(
          "تعذر فتح الصورة. حاول مرة أخرى."
        );

        return;
      }

      setLightboxImage({
        id: imageId,
        url,
      });
    };

  /*
  =========================================================
  RETRY IMAGE
  =========================================================
  */

  const retryImage =
    async (item) => {
      const imageId =
        String(
          item?.id || ""
        );

      if (!imageId) {
        return;
      }

      const old =
        imageObjectUrlsRef.current.get(
          imageId
        );

      if (
        old?.startsWith(
          "blob:"
        )
      ) {
        try {
          URL.revokeObjectURL(
            old
          );
        } catch {
          // ignore
        }
      }

      imageObjectUrlsRef.current.delete(
        imageId
      );

      setImageUrls(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            imageId
          ];

          return next;
        }
      );

      await loadProtectedImage(
        item
      );
    };

  /*
  =========================================================
  DOWNLOAD IMAGE
  =========================================================
  */

  const downloadImage =
    async (image) => {
      if (
        !image?.url
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            image.url,
            image.url.startsWith(
              "blob:"
            )
              ? undefined
              : {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
          );

        if (!response.ok) {
          throw new Error(
            "تعذر تنزيل الصورة"
          );
        }

        const blob =
          await response.blob();

        if (!blob.size) {
          throw new Error(
            "الصورة فارغة"
          );
        }

        const blobUrl =
          URL.createObjectURL(
            blob
          );

        const extension =
          blob.type ===
          "image/png"
            ? "png"
            : blob.type ===
              "image/webp"
            ? "webp"
            : "jpg";

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

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              blobUrl
            ),
          1500
        );
      } catch {
        alert(
          "تعذر تنزيل الصورة، حاول مرة أخرى."
        );
      }
    };

  /*
  =========================================================
  SEND TEXT
  =========================================================
  */

  const sendTextMessage =
    async () => {
      const text =
        message.trim();

      if (
        !text ||
        !selectedClient?.id ||
        sending
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

            body: JSON.stringify({
              receiver_id:
                selectedClient.id,

              message:
                text,
            }),
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "حدث خطأ أثناء إرسال الرسالة"
        );
      }

      if (data.data) {
        setMessages(
          (prev) => [
            ...prev,
            data.data,
          ]
        );
      }

      setMessage("");
    };

  /*
  =========================================================
  SEND IMAGE
  =========================================================
  */

  const sendImage =
    async () => {
      if (
        !selectedImage ||
        !selectedClient?.id ||
        uploadingImage
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
            selectedClient.id
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

              body:
                formData,
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "حدث خطأ أثناء إرسال الصورة"
          );
        }

        if (data.data) {
          setMessages(
            (prev) => [
              ...prev,
              data.data,
            ]
          );
        }

        clearImage();
      } catch (error) {
        alert(
          error.message ||
            "تعذر إرسال الصورة"
        );
      } finally {
        setUploadingImage(
          false
        );
      }
    };

  /*
  =========================================================
  SEND MESSAGE
  =========================================================
  */

  const sendMessage =
    async (event) => {
      event.preventDefault();

      if (
        !selectedClient?.id ||
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
  =========================================================
  LOADING
  =========================================================
  */

  if (
    loadingClients
  ) {
    return (
      <div
        className="admin-chat-page"
        dir="rtl"
      >
        <div className="admin-chat-loading">
          جاري تحميل العملاء...
        </div>
      </div>
    );
  }

  /*
  =========================================================
  UI
  =========================================================
  */

  return (
    <div
      className="admin-chat-page"
      dir="rtl"
    >
      <header className="admin-chat-header">

        <div>

          <span className="admin-chat-label">
            GYM COACH / MESSAGES
          </span>

          <h1>
            <span className="chat-title-icon">
              ●
            </span>{" "}
            الدردشة مع العملاء
          </h1>

          <p>
            تواصل مباشرة مع عملائك
            وأرسل النصوص والصور بسهولة.
          </p>

        </div>

      </header>

      <div className="admin-chat-container">

        <aside className="admin-chat-clients">

          <div className="admin-chat-clients-heading">

            <div>

              <span>
                CONTACTS
              </span>

              <strong>
                العملاء
              </strong>

            </div>

            <b>
              {clients.length}
            </b>

          </div>

          <div className="admin-chat-search">

            <span>
              ⌕
            </span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="بحث عن عميل..."
            />

          </div>

          <div className="admin-client-list">

            {filteredClients.length ===
            0 ? (
              <div className="admin-chat-no-clients">
                لا توجد نتائج.
              </div>
            ) : (
              filteredClients.map(
                (client) => {
                  const unread =
                    Number(
                      unreadByClient[
                        String(
                          client.id
                        )
                      ] || 0
                    );

                  return (
                    <button
                      key={
                        client.id
                      }
                      type="button"
                      className={`admin-client-item ${
                        selectedClient?.id ===
                        client.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        handleSelectClient(
                          client
                        )
                      }
                    >

                      <div className="admin-client-avatar">

                        <span>
                          {client.name
                            ?.charAt(
                              0
                            )
                            ?.toUpperCase() ||
                            "C"}
                        </span>

                        <i />

                      </div>

                      <div className="admin-client-info">

                        <strong>
                          {client.name}
                        </strong>

                        <span>
                          {client.email ||
                            "عميل"}
                        </span>

                      </div>

                      {unread >
                        0 && (
                        <span className="admin-client-unread">

                          {unread >
                          99
                            ? "99+"
                            : unread}

                        </span>
                      )}

                      <small>
                        ›
                      </small>

                    </button>
                  );
                }
              )
            )}

          </div>

        </aside>

        <section className="admin-chat-box">

          {!selectedClient ? (
            <div className="admin-chat-select">

              <div className="chat-empty-icon">
                ●
              </div>

              <h2>
                اختر عميلًا
              </h2>

              <p>
                اختر أحد العملاء من القائمة
                لبدء المحادثة.
              </p>

            </div>
          ) : (
            <>

              <div className="admin-conversation-header">

                <div className="admin-conversation-avatar">

                  <span>
                    {selectedClient.name
                      ?.charAt(
                        0
                      )
                      ?.toUpperCase() ||
                      "C"}
                  </span>

                  <i />

                </div>

                <div>

                  <strong>
                    {selectedClient.name}
                  </strong>

                  <span>
                    عميل • متاح للمراسلة
                  </span>

                </div>

              </div>

              <div className="admin-chat-messages">

                {loadingMessages ? (
                  <div className="admin-chat-loading">
                    جاري تحميل المحادثة...
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="admin-chat-empty">

                    <div className="chat-empty-icon">
                      ●
                    </div>

                    <h3>
                      لا توجد رسائل
                    </h3>

                    <p>
                      ابدأ المحادثة وأرسل
                      أول رسالة أو صورة.
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
                        isImageMessage(
                          item
                        );

                      const imageId =
                        String(
                          item.id
                        );

                      const itemImageUrl =
                        imageUrls[
                          imageId
                        ] || "";

                      const imageError =
                        Boolean(
                          imageErrors[
                            imageId
                          ]
                        );

                      return (
                        <div
                          key={
                            item.id
                          }
                          className={`admin-message ${
                            isMine
                              ? "mine"
                              : ""
                          }`}
                        >

                          <div className="admin-message-bubble">

                            {hasImage &&
                              (itemImageUrl ? (
                                <button
                                  type="button"
                                  className="chat-message-image-button"
                                  onClick={() =>
                                    openImage(
                                      item
                                    )
                                  }
                                  title="فتح الصورة بالحجم الكامل"
                                >
                                  <img
                                    className="chat-message-image"
                                    src={
                                      itemImageUrl
                                    }
                                    alt="صورة مرسلة في المحادثة"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="chat-image-loading-button"
                                  onClick={() =>
                                    imageError
                                      ? retryImage(
                                          item
                                        )
                                      : openImage(
                                          item
                                        )
                                  }
                                >
                                  {imageError
                                    ? "تعذر تحميل الصورة — اضغط للمحاولة مرة أخرى"
                                    : "تحميل الصورة..."}
                                </button>
                              ))}

                            {item.message && (
                              <p>
                                {item.message}
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

              </div>

              {imagePreview && (
                <div className="chat-image-preview-row">

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
                    aria-label="إلغاء الصورة"
                  >
                    ×
                  </button>

                </div>
              )}

              <form
                className="admin-chat-form"
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
                  onChange={(
                    event
                  ) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder="اكتب رسالتك للعميل..."
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
                    (!message.trim() &&
                      !selectedImage)
                  }
                >
                  {sending ||
                  uploadingImage
                    ? "..."
                    : "إرسال ➊"}
                </button>

              </form>

              <div className="chat-form-hint">
                JPG, PNG, WEBP • بحد أقصى
                5MB • اضغط على أي صورة
                لفتحها كاملة
              </div>

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
                      setLightboxImage(
                        null
                      );
                    }
                  }}
                >

                  <div className="chat-image-lightbox-content">

                    <button
                      type="button"
                      className="chat-lightbox-close"
                      onClick={() =>
                        setLightboxImage(
                          null
                        )
                      }
                      aria-label="إغلاق"
                    >
                      ×
                    </button>

                    <img
                      src={
                        lightboxImage.url
                      }
                      alt="الصورة بالحجم الكامل"
                      decoding="async"
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
                            lightboxImage.url,
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

            </>
          )}

        </section>

      </div>
    </div>
  );
}

export default AdminChat;