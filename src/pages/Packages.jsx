import API_URL from "../config/api";
import {
  useEffect,
  useState,
} from "react";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  duration_days: "",
  features: "",
  is_active: true,
  is_featured: false,
};

function Packages() {
  const [packages, setPackages] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);

  const [editingId, setEditingId] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const token =
    localStorage.getItem(
      "token"
    );

  /*
  ========================================
  جلب الباقات
  ========================================
  */

  const fetchPackages =
    async () => {
      try {
        setPageLoading(true);

        const response =
          await fetch(
            `${API_URL}/packages`
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "تعذر تحميل الباقات"
          );

          return;
        }

        setPackages(
          data.packages || []
        );
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setPageLoading(
          false
        );
      }
    };

  useEffect(() => {
    fetchPackages();
  }, []);

  /*
  ========================================
  تغيير الحقول
  ========================================
  */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setForm(
      (previous) => ({
        ...previous,

        [name]:
          type === "checkbox"
            ? checked
            : value,
      })
    );
  };

  /*
  ========================================
  إرسال النموذج
  ========================================
  */

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !form.name.trim()
      ) {
        alert(
          "اكتب اسم الباقة"
        );

        return;
      }

      if (
        form.price === "" ||
        Number(form.price) <
          0
      ) {
        alert(
          "أدخل سعرًا صحيحًا"
        );

        return;
      }

      if (
        form.duration_days ===
          "" ||
        Number(
          form.duration_days
        ) <= 0
      ) {
        alert(
          "أدخل مدة صحيحة"
        );

        return;
      }

      if (!token) {
        alert(
          "انتهت جلسة تسجيل الدخول"
        );

        window.location.href =
          "/login";

        return;
      }

      setLoading(true);

      const url = editingId
        ? `${API_URL}/packages/${editingId}`
        : `${API_URL}/packages`;

      const method = editingId
        ? "PUT"
        : "POST";

      try {
        const response =
          await fetch(url, {
            method,

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              name:
                form.name.trim(),

              description:
                form.description.trim(),

              price: Number(
                form.price
              ),

              duration_days:
                Number(
                  form.duration_days
                ),

              features:
                form.features.trim(),

              is_active:
                Boolean(
                  form.is_active
                ),

              is_featured:
                Boolean(
                  form.is_featured
                ),
            }),
          });

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "حدث خطأ"
          );

          return;
        }

        alert(
          data.message ||
            "تم الحفظ بنجاح"
        );

        setForm(emptyForm);

        setEditingId(null);

        await fetchPackages();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  ========================================
  تعديل
  ========================================
  */

  const handleEdit =
    (pkg) => {
      setEditingId(
        pkg.id
      );

      setForm({
        name:
          pkg.name || "",

        description:
          pkg.description ||
          "",

        price:
          pkg.price ?? "",

        duration_days:
          pkg.duration_days ??
          "",

        features:
          pkg.features || "",

        is_active:
          Boolean(
            pkg.is_active
          ),

        is_featured:
          Boolean(
            pkg.is_featured
          ),
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  /*
  ========================================
  إلغاء التعديل
  ========================================
  */

  const cancelEdit =
    () => {
      setEditingId(null);

      setForm(emptyForm);
    };

  /*
  ========================================
  حذف
  ========================================
  */

  const handleDelete =
    async (id) => {
      const confirmed =
        window.confirm(
          "هل أنت متأكد من حذف هذه الباقة؟"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/packages/${id}`,
            {
              method:
                "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "تعذر حذف الباقة"
          );

          return;
        }

        alert(
          data.message ||
            "تم حذف الباقة"
        );

        await fetchPackages();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      }
    };

  /*
  ========================================
  إظهار / إخفاء
  ========================================
  */

  const toggleActive =
    async (pkg) => {
      try {
        const response =
          await fetch(
            `${API_URL}/packages/${pkg.id}/toggle`,
            {
              method:
                "PATCH",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "حدث خطأ"
          );

          return;
        }

        await fetchPackages();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      }
    };

  /*
  ========================================
  مميزة / عادية
  ========================================
  */

  const toggleFeatured =
    async (pkg) => {
      try {
        const response =
          await fetch(
            `${API_URL}/packages/${pkg.id}/featured`,
            {
              method:
                "PATCH",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          alert(
            data.message ||
              "حدث خطأ"
          );

          return;
        }

        await fetchPackages();
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      }
    };

  /*
  ========================================
  إحصائيات
  ========================================
  */

  const activePackages =
    packages.filter(
      (pkg) =>
        Boolean(
          pkg.is_active
        )
    ).length;

  const featuredPackages =
    packages.filter(
      (pkg) =>
        Boolean(
          pkg.is_featured
        )
    ).length;

  const totalSubscribers =
    packages.reduce(
      (
        total,
        pkg
      ) =>
        total +
        Number(
          pkg.active_subscribers ||
            0
        ),
      0
    );

  /*
  ========================================
  Loading
  ========================================
  */

  if (pageLoading) {
    return (
      <div
        className="packages-page luxury-page"
        dir="rtl"
      >
        <div
          className="luxury-card"
          style={{
            padding: "50px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize:
                "40px",
              marginBottom:
                "15px",
            }}
          >
            ✦
          </div>

          <h2>
            جاري تحميل الباقات...
          </h2>
        </div>
      </div>
    );
  }

  /*
  ========================================
  الصفحة
  ========================================
  */

  return (
    <div
      className="packages-page luxury-page"
      dir="rtl"
    >

      {/* Header */}

      <div className="luxury-page-header">

        <div>

          <span className="gold-label">
            GYM COACH
          </span>

          <h1>
            إدارة الباقات
          </h1>

          <p>
            تحكم في أسعار ومدد ومميزات
            باقاتك التدريبية.
          </p>

        </div>

        <div className="package-count">

          <strong>
            {
              packages.length
            }
          </strong>

          <span>
            إجمالي الباقات
          </span>

        </div>

      </div>


      {/* Stats */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",

          gap: "15px",

          marginBottom:
            "25px",
        }}
      >

        <div className="luxury-card">

          <span>
            الباقات الظاهرة
          </span>

          <h2>
            {
              activePackages
            }
          </h2>

        </div>

        <div className="luxury-card">

          <span>
            الباقة المميزة
          </span>

          <h2>
            {
              featuredPackages
            }
          </h2>

        </div>

        <div className="luxury-card">

          <span>
            المشتركين النشطين
          </span>

          <h2>
            {
              totalSubscribers
            }
          </h2>

        </div>

      </div>


      {/* Form */}

      <div className="package-form-box luxury-card">

        <div className="section-title">

          <span>
            {editingId
              ? "✦"
              : "+"}
          </span>

          <div>

            <h2>
              {editingId
                ? "تعديل الباقة"
                : "إضافة باقة جديدة"}
            </h2>

            <p>
              {editingId
                ? "قم بتعديل بيانات الباقة"
                : "أضف عرضًا جديدًا لعملائك"}
            </p>

          </div>

        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="package-form"
        >

          {/* Name */}

          <div className="form-group">

            <label>
              اسم الباقة
            </label>

            <input
              name="name"
              placeholder="مثال: الباقة الذهبية"
              value={
                form.name
              }
              onChange={
                handleChange
              }
            />

          </div>


          {/* Description */}

          <div className="form-group">

            <label>
              وصف الباقة
            </label>

            <textarea
              name="description"
              placeholder="اكتب وصفًا مختصرًا للباقة..."
              value={
                form.description
              }
              onChange={
                handleChange
              }
              rows="4"
            />

          </div>


          {/* Features */}

          <div className="form-group">

            <label>
              مميزات الباقة
            </label>

            <textarea
              name="features"
              placeholder={
                "برنامج تدريبي مخصص\nمتابعة مع المدرب\nتمارين منظمة\nمتابعة التقدم"
              }
              value={
                form.features
              }
              onChange={
                handleChange
              }
              rows="5"
            />

            <small
              style={{
                display:
                  "block",

                marginTop:
                  "8px",

                opacity: 0.7,
              }}
            >
              اكتب كل ميزة في سطر منفصل.
            </small>

          </div>


          {/* Price + Duration */}

          <div className="form-row">

            <div className="form-group">

              <label>
                السعر
              </label>

              <div className="input-with-unit">

                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="500"
                  value={
                    form.price
                  }
                  onChange={
                    handleChange
                  }
                />

                <span>
                  جنيه
                </span>

              </div>

            </div>

            <div className="form-group">

              <label>
                مدة الباقة
              </label>

              <div className="input-with-unit">

                <input
                  name="duration_days"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={
                    form.duration_days
                  }
                  onChange={
                    handleChange
                  }
                />

                <span>
                  يوم
                </span>

              </div>

            </div>

          </div>


          {/* Options */}

          <div
            style={{
              display:
                "grid",

              gap: "12px",

              marginTop:
                "10px",
            }}
          >

            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: "10px",

                cursor:
                  "pointer",
              }}
            >

              <input
                type="checkbox"
                name="is_active"
                checked={
                  form.is_active
                }
                onChange={
                  handleChange
                }
              />

              <span>
                إظهار الباقة للعملاء
              </span>

            </label>

            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: "10px",

                cursor:
                  "pointer",
              }}
            >

              <input
                type="checkbox"
                name="is_featured"
                checked={
                  form.is_featured
                }
                onChange={
                  handleChange
                }
              />

              <span>
                ⭐ جعل الباقة مميزة
              </span>

            </label>

          </div>


          {/* Buttons */}

          <div className="package-form-actions">

            <button
              type="submit"
              className="gold-button"
              disabled={
                loading
              }
            >
              {loading
                ? "جاري الحفظ..."
                : editingId
                ? "حفظ التعديلات"
                : "إضافة الباقة"}
            </button>

            {editingId && (
              <button
                type="button"
                className="dark-button"
                onClick={
                  cancelEdit
                }
              >
                إلغاء
              </button>
            )}

          </div>

        </form>

      </div>


      {/* Packages */}

      <section className="packages-list">

        <div className="section-heading">

          <div>

            <span className="gold-label">
              OFFERS
            </span>

            <h2>
              الباقات الحالية
            </h2>

          </div>

        </div>

        {packages.length ===
        0 ? (

          <div className="empty-packages luxury-card">

            <div>
              ✦
            </div>

            <h3>
              لا توجد باقات حتى الآن
            </h3>

            <p>
              أضف أول باقة ليتمكن عملاؤك
              من رؤيتها.
            </p>

          </div>

        ) : (

          <div className="packages-grid">

            {packages.map(
              (pkg) => {
                const features =
                  String(
                    pkg.features ||
                      ""
                  )
                    .split(
                      "\n"
                    )
                    .map(
                      (
                        item
                      ) =>
                        item.trim()
                    )
                    .filter(
                      Boolean
                    );

                return (
                  <article
                    className="package-card luxury-card"
                    key={
                      pkg.id
                    }
                    style={{
                      opacity:
                        pkg.is_active
                          ? 1
                          : 0.65,
                    }}
                  >

                    {/* Top */}

                    <div className="package-card-top">

                      <span className="package-badge">
                        {pkg.is_active
                          ? "متاحة للعملاء"
                          : "مخفية"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          toggleFeatured(
                            pkg
                          )
                        }
                        style={{
                          border:
                            "none",

                          background:
                            "transparent",

                          cursor:
                            "pointer",

                          fontSize:
                            "22px",
                        }}
                        title={
                          pkg.is_featured
                            ? "إلغاء التمييز"
                            : "تحديد كمميزة"
                        }
                      >
                        {pkg.is_featured
                          ? "⭐"
                          : "☆"}
                      </button>

                    </div>


                    <h3>
                      {
                        pkg.name
                      }
                    </h3>

                    {pkg.description && (
                      <p className="package-description">
                        {
                          pkg.description
                        }
                      </p>
                    )}


                    {/* Price */}

                    <div className="package-price">

                      <strong>
                        {Number(
                          pkg.price
                        ).toLocaleString(
                          "ar-EG"
                        )}
                      </strong>

                      <span>
                        جنيه
                      </span>

                    </div>


                    {/* Duration */}

                    <div className="package-duration">

                      <span>
                        ◷
                      </span>

                      <span>
                        مدة الاشتراك:
                      </span>

                      <strong>
                        {
                          pkg.duration_days
                        }{" "}
                        يوم
                      </strong>

                    </div>


                    {/* Subscribers */}

                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap: "10px",

                        marginTop:
                          "15px",

                        padding:
                          "12px",

                        borderRadius:
                          "12px",

                        background:
                          "rgba(255,255,255,0.03)",
                      }}
                    >

                      <span>
                        المشتركين النشطين
                      </span>

                      <strong>
                        {Number(
                          pkg.active_subscribers ||
                            0
                        )}
                      </strong>

                    </div>


                    {/* Features */}

                    {features.length >
                      0 && (
                      <ul
                        style={{
                          margin:
                            "15px 0",

                          paddingRight:
                            "20px",
                        }}
                      >

                        {features.map(
                          (
                            feature,
                            index
                          ) => (
                            <li
                              key={`${pkg.id}-${index}`}
                              style={{
                                marginBottom:
                                  "7px",
                              }}
                            >
                              ✓{" "}
                              {
                                feature
                              }
                            </li>
                          )
                        )}

                      </ul>
                    )}


                    {/* Actions */}

                    <div className="package-actions">

                      <button
                        type="button"
                        className="edit-button"
                        onClick={() =>
                          handleEdit(
                            pkg
                          )
                        }
                      >
                        تعديل
                      </button>

                      <button
                        type="button"
                        className="edit-button"
                        onClick={() =>
                          toggleActive(
                            pkg
                          )
                        }
                      >
                        {pkg.is_active
                          ? "إخفاء"
                          : "إظهار"}
                      </button>

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() =>
                          handleDelete(
                            pkg.id
                          )
                        }
                      >
                        حذف
                      </button>

                    </div>

                  </article>
                );
              }
            )}

          </div>
        )}

      </section>

    </div>
  );
}

export default Packages;