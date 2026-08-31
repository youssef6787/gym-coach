import API_URL from "../config/api";
import { useEffect, useState } from "react";

function Transformations() {
  const [transformations, setTransformations] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [editing, setEditing] =
    useState(null);

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "transformation",
    image: null,
  });

  const token =
    localStorage.getItem("token");

  /*
  ========================================
  جلب الصور
  ========================================
  */

  const fetchTransformations =
    async () => {
      try {
        setLoading(true);

        const response =
          await fetch(
            `${API_URL}/transformations/admin`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.message ||
              "حدث خطأ أثناء جلب الصور"
          );

          return;
        }

        if (data.success) {
          setTransformations(
            data.transformations || []
          );
        } else {
          setTransformations([]);
        }
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
  أول تحميل
  ========================================
  */

  useEffect(() => {
    fetchTransformations();
  }, []);

  /*
  ========================================
  تغيير بيانات النموذج
  ========================================
  */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
      files,
    } = event.target;

    if (name === "image") {
      setForm(
        (previous) => ({
          ...previous,
          image:
            files &&
            files.length > 0
              ? files[0]
              : null,
        })
      );

      return;
    }

    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  /*
  ========================================
  رفع صورة
  ========================================
  */

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !form.title.trim()
      ) {
        alert(
          "اكتب عنوان الصورة"
        );

        return;
      }

      if (!form.image) {
        alert(
          "اختر صورة أولًا"
        );

        return;
      }

      try {
        setUploading(true);

        const formData =
          new FormData();

        formData.append(
          "title",
          form.title.trim()
        );

        formData.append(
          "description",
          form.description.trim()
        );

        formData.append(
          "type",
          form.type
        );

        formData.append(
          "image",
          form.image
        );

        const response =
          await fetch(
            `${API_URL}/transformations`,
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

        if (!response.ok) {
          alert(
            data.message ||
              "حدث خطأ أثناء رفع الصورة"
          );

          return;
        }

        alert(
          data.message ||
            "تم رفع الصورة بنجاح"
        );

        /*
        تنظيف النموذج
        */

        setForm({
          title: "",
          description: "",
          type: "transformation",
          image: null,
        });

        /*
        إعادة تحميل الصور
        */

        await fetchTransformations();

        /*
        إعادة ضبط input الصورة
        */

        const fileInput =
          document.getElementById(
            "transformation-image"
          );

        if (fileInput) {
          fileInput.value = "";
        }
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setUploading(false);
      }
    };

  /*
  ========================================
  حذف صورة
  ========================================
  */

  const deleteTransformation =
    async (id) => {
      const confirmed =
        window.confirm(
          "هل أنت متأكد من حذف هذه الصورة؟"
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/transformations/${id}`,
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

        if (!response.ok) {
          alert(
            data.message ||
              "حدث خطأ أثناء حذف الصورة"
          );

          return;
        }

        alert(
          data.message ||
            "تم حذف الصورة"
        );

        setTransformations(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        );
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      }
    };

  /*
  ========================================
  إظهار / إخفاء الصورة
  ========================================
  */

  const toggleVisibility =
    async (
      transformation
    ) => {
      try {
        const newVisibility =
          !Boolean(
            transformation.is_visible
          );

        const response =
          await fetch(
            `${API_URL}/transformations/${transformation.id}/visibility`,
            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  is_visible:
                    newVisibility,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.message ||
              "حدث خطأ أثناء تغيير حالة الصورة"
          );

          return;
        }

        setTransformations(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                transformation.id
                  ? {
                      ...item,
                      is_visible:
                        newVisibility,
                    }
                  : item
            )
        );
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      }
    };

  /*
  ========================================
  تعديل بيانات الصورة
  ========================================
  */

  const saveEdit =
    async (event) => {
      event.preventDefault();

      if (
        !editing?.title?.trim()
      ) {
        alert(
          "عنوان الصورة مطلوب"
        );

        return;
      }

      try {
        setSavingEdit(true);

        const response =
          await fetch(
            `${API_URL}/transformations/${editing.id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  title:
                    editing.title.trim(),

                  description:
                    editing.description ||
                    "",

                  type:
                    editing.type,

                  is_visible:
                    Boolean(
                      editing.is_visible
                    ),
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.message ||
              "حدث خطأ أثناء تعديل الصورة"
          );

          return;
        }

        setTransformations(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                editing.id
                  ? {
                      ...item,

                      title:
                        editing.title.trim(),

                      description:
                        editing.description ||
                        null,

                      type:
                        editing.type,

                      is_visible:
                        Boolean(
                          editing.is_visible
                        ),
                    }
                  : item
            )
        );

        setEditing(null);

        alert(
          data.message ||
            "تم تعديل الصورة بنجاح"
        );
      } catch {
        alert(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setSavingEdit(false);
      }
    };

  /*
  ========================================
  Loading
  ========================================
  */

  if (loading) {
    return (
      <div
        className="training-page"
        dir="rtl"
      >
        <div className="training-box">

          <h1>
            📸 التحولات والأعمال
          </h1>

          <p>
            جاري تحميل الصور...
          </p>

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
      className="training-page"
      dir="rtl"
    >

      {/* ==================================
          العنوان
      ================================== */}

      <div className="training-box">

        <h1>
          📸 التحولات والأعمال
        </h1>

        <p>
          أضف صور نتائج العملاء
          والأعمال التي أنجزها
          المدرب لعرضها على الصفحة
          الرئيسية.
        </p>

      </div>

      {/* ==================================
          إضافة صورة
      ================================== */}

      <div className="training-box">

        <h2>
          إضافة صورة جديدة
        </h2>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <input
            type="text"
            name="title"
            placeholder="عنوان الصورة"
            value={
              form.title
            }
            onChange={
              handleChange
            }
            required
          />

          <textarea
            name="description"
            placeholder="وصف الصورة"
            value={
              form.description
            }
            onChange={
              handleChange
            }
          />

          <select
            name="type"
            value={
              form.type
            }
            onChange={
              handleChange
            }
          >

            <option value="transformation">
              💪 تحول عميل
            </option>

            <option value="work">
              🏆 عمل أنجزه المدرب
            </option>

          </select>

          <div className="transformation-upload-field">

            <label htmlFor="transformation-image">
              اختر الصورة
            </label>

            <input
              id="transformation-image"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              onChange={
                handleChange
              }
              required
            />

            {form.image && (
              <p>
                الصورة المختارة:{" "}
                <strong>
                  {
                    form.image.name
                  }
                </strong>
              </p>
            )}

          </div>

          <button
            type="submit"
            disabled={
              uploading
            }
          >
            {uploading
              ? "جاري رفع الصورة..."
              : "📤 رفع وإضافة الصورة"}
          </button>

        </form>

      </div>

      {/* ==================================
          الصور
      ================================== */}

      <div className="training-box">

        <div className="selected-program-header">

          <div>

            <h2>
              الصور المضافة
            </h2>

            <p>
              إجمالي الصور:{" "}
              {
                transformations.length
              }
            </p>

          </div>

        </div>

        {transformations.length ===
        0 ? (

          <div className="empty-state">

            <span>
              📸
            </span>

            <h3>
              لا توجد صور حتى الآن
            </h3>

            <p>
              أضف أول صورة لتظهر
              في الصفحة الرئيسية.
            </p>

          </div>

        ) : (

          <div className="programs-grid">

            {transformations.map(
              (item) => (

                <div
                  className="program-card transformation-card"
                  key={
                    item.id
                  }
                >

                  {/* الصورة */}

                  <div className="transformation-image-wrapper">

                    <img
                      src={`${API_URL}${item.image_url}`}
                      alt={
                        item.title
                      }
                      className="transformation-image"
                    />

                  </div>

                  {/* البيانات */}

                  <div className="transformation-card-content">

                    <h3>
                      {
                        item.title
                      }
                    </h3>

                    <div className="transformation-type">

                      {item.type ===
                      "transformation"
                        ? "💪 تحول عميل"
                        : "🏆 عمل المدرب"}

                    </div>

                    {item.description && (
                      <p>
                        {
                          item.description
                        }
                      </p>
                    )}

                    {/* الحالة */}

                    <div className="transformation-status">

                      <span>
                        الحالة:
                      </span>

                      <strong>
                        {Boolean(
                          item.is_visible
                        )
                          ? "👁️ ظاهرة للزوار"
                          : "🙈 مخفية"}
                      </strong>

                    </div>

                    {/* الأزرار */}

                    <div className="training-actions transformation-actions">

                      <button
                        type="button"
                        className="edit-button"
                        onClick={() =>
                          setEditing({
                            id:
                              item.id,

                            title:
                              item.title ||
                              "",

                            description:
                              item.description ||
                              "",

                            type:
                              item.type ||
                              "transformation",

                            is_visible:
                              Boolean(
                                item.is_visible
                              ),
                          })
                        }
                      >
                        ✏️ تعديل
                      </button>

                      <button
                        type="button"
                        className="visibility-button"
                        onClick={() =>
                          toggleVisibility(
                            item
                          )
                        }
                      >
                        {Boolean(
                          item.is_visible
                        )
                          ? "🙈 إخفاء"
                          : "👁️ إظهار"}
                      </button>

                      <button
                        type="button"
                        className="delete-button"
                        onClick={() =>
                          deleteTransformation(
                            item.id
                          )
                        }
                      >
                        🗑️ حذف
                      </button>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </div>

      {editing && (
        <div
          className="transformation-modal-backdrop"
          role="presentation"
        >

          <div
            className="transformation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-transformation-title"
          >

            <div className="transformation-modal-header">

              <div>

                <span>
                  EDIT TRANSFORMATION
                </span>

                <h2 id="edit-transformation-title">
                  تعديل الصورة
                </h2>

              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() =>
                  setEditing(null)
                }
                disabled={
                  savingEdit
                }
                aria-label="إغلاق"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                saveEdit
              }
              className="transformation-edit-form"
            >

              <label>

                عنوان الصورة

                <input
                  type="text"
                  value={
                    editing.title
                  }
                  onChange={(
                    event
                  ) =>
                    setEditing(
                      (
                        previous
                      ) => ({
                        ...previous,
                        title:
                          event.target
                            .value,
                      })
                    )
                  }
                  required
                />

              </label>

              <label>

                الوصف

                <textarea
                  value={
                    editing.description
                  }
                  onChange={(
                    event
                  ) =>
                    setEditing(
                      (
                        previous
                      ) => ({
                        ...previous,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  rows={4}
                />

              </label>

              <label>

                النوع

                <select
                  value={
                    editing.type
                  }
                  onChange={(
                    event
                  ) =>
                    setEditing(
                      (
                        previous
                      ) => ({
                        ...previous,
                        type:
                          event.target
                            .value,
                      })
                    )
                  }
                >

                  <option value="transformation">
                    💪 تحول عميل
                  </option>

                  <option value="work">
                    🏆 عمل أنجزه المدرب
                  </option>

                </select>

              </label>

              <label className="visibility-check">

                <input
                  type="checkbox"
                  checked={Boolean(
                    editing.is_visible
                  )}
                  onChange={(
                    event
                  ) =>
                    setEditing(
                      (
                        previous
                      ) => ({
                        ...previous,
                        is_visible:
                          event.target
                            .checked,
                      })
                    )
                  }
                />

                <span>
                  إظهار الصورة للزوار
                </span>

              </label>

              <div className="transformation-modal-actions">

                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={() =>
                    setEditing(null)
                  }
                  disabled={
                    savingEdit
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="modal-save-button"
                  disabled={
                    savingEdit
                  }
                >
                  {savingEdit
                    ? "جاري الحفظ..."
                    : "حفظ التعديل"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Transformations;