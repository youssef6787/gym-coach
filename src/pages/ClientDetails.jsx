import API_URL from "../config/api";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "./ClientDetails.css";

const statusLabels = {
  active: "نشط",
  pending: "قيد المراجعة",
  rejected: "مرفوض",
  paused: "موقوف",
  expired: "منتهي",
};

const getToken = () =>
  localStorage.getItem("token") || "";

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${new Intl.NumberFormat("ar-EG").format(
    number
  )} ج.م`;
};

const toNumberOrNull = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const emptyExercise = () => ({
  name: "",
  description: "",
  sets: "",
  reps: "",
  rest_seconds: "",
  video_url: "",
  exercise_order: "",
});

const emptyMeal = () => ({
  name: "",
  description: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
});

const emptyNutrition = () => ({
  name: "",
  description: "",
  meals: [emptyMeal()],
});

async function apiRequest(path, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",

    ...(options.body
      ? {
          "Content-Type": "application/json",
        }
      : {}),

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),

    ...(options.headers || {}),
  };

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message ||
        result.error ||
        `حدث خطأ أثناء تنفيذ الطلب (${response.status})`
    );
  }

  return result;
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  large = false,
}) {
  return (
    <div
      className="client-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className={`client-modal ${
          large ? "client-modal-large" : ""
        }`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="client-modal-header">
          <div>
            <span>{eyebrow}</span>

            <h2>{title}</h2>
          </div>

          <button
            type="button"
            className="client-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function ClientDetails({
  clientId,
  onBack,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [
    activeSection,
    setActiveSection,
  ] = useState("overview");

  const [
    programModal,
    setProgramModal,
  ] = useState(false);

  const [programForm, setProgramForm] =
    useState({
      name: "",
      description: "",
    });

  const [
    newDayModal,
    setNewDayModal,
  ] = useState(null);

  const [newDayForm, setNewDayForm] =
    useState({
      name: "",
    });

  const [
    editingDay,
    setEditingDay,
  ] = useState(null);

  const [dayForm, setDayForm] =
    useState({
      day_number: "",
      name: "",
    });

  const [
    trainingModal,
    setTrainingModal,
  ] = useState(null);

  const [
    editingExercise,
    setEditingExercise,
  ] = useState(null);

  const [
    exerciseForm,
    setExerciseForm,
  ] = useState(emptyExercise());

  const [
    exerciseVideoFile,
    setExerciseVideoFile,
  ] = useState(null);

  const [
    videoUploading,
    setVideoUploading,
  ] = useState(false);

  const exerciseVideoInputRef =
    useRef(null);

  const [expandedDays, setExpandedDays] =
    useState({});

  const [
    archivedProgram,
    setArchivedProgram,
  ] = useState(null);

  const [
    exerciseLibrary,
    setExerciseLibrary,
  ] = useState([]);

  const [
    exerciseSearch,
    setExerciseSearch,
  ] = useState("");

  const [
    libraryLoading,
    setLibraryLoading,
  ] = useState(false);

  const [
    showNutritionForm,
    setShowNutritionForm,
  ] = useState(false);

  const [
    editingNutritionPlan,
    setEditingNutritionPlan,
  ] = useState(null);

  const [
    nutritionForm,
    setNutritionForm,
  ] = useState(emptyNutrition());

  const [
    expandedNutrition,
    setExpandedNutrition,
  ] = useState({});

  const loadClient = async () => {
    const numericClientId =
      Number(clientId);

    if (
      !Number.isInteger(numericClientId) ||
      numericClientId <= 0
    ) {
      setLoading(false);
      setError("رقم العميل غير صحيح");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await apiRequest(
        `/clients/${numericClientId}/details`
      );

      setData(result);
    } catch (requestError) {
      setError(
        requestError.message ||
          "حدث خطأ أثناء تحميل ملف العميل"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const client = data?.client || {};

  const subscription =
    data?.currentSubscription ||
    data?.subscription ||
    null;

  const programs = Array.isArray(
    data?.programs
  )
    ? data.programs
    : [];

  const nutritionPlans = Array.isArray(
    data?.nutritionPlans
  )
    ? data.nutritionPlans
    : [];

  const progress = Array.isArray(
    data?.progress
  )
    ? data.progress
    : [];

  const currentProgram =
    programs[0] || null;

  const totalExercises = useMemo(
    () =>
      programs.reduce(
        (total, program) =>
          total +
          (program.days || []).reduce(
            (dayTotal, day) =>
              dayTotal +
              (day.exercises || []).length,
            0
          ),
        0
      ),
    [programs]
  );

  const completedExercises = useMemo(
    () =>
      progress.filter(
        (item) => Boolean(item.completed)
      ).length,
    [progress]
  );

  const progressPercentage =
    totalExercises > 0
      ? Math.min(
          100,
          Math.round(
            (completedExercises /
              totalExercises) *
              100
          )
        )
      : 0;

  const daysRemaining = useMemo(() => {
    if (!subscription?.end_date) {
      return null;
    }

    const end = new Date(
      subscription.end_date
    );

    if (Number.isNaN(end.getTime())) {
      return null;
    }

    const difference =
      end.getTime() - Date.now();

    if (difference <= 0) {
      return 0;
    }

    return Math.ceil(
      difference / 86400000
    );
  }, [subscription]);

  const nutritionTotals = (meals = []) =>
    meals.reduce(
      (totals, meal) => ({
        calories:
          totals.calories +
          (Number(meal.calories) || 0),

        protein:
          totals.protein +
          (Number(meal.protein) || 0),

        carbs:
          totals.carbs +
          (Number(meal.carbs) || 0),

        fats:
          totals.fats +
          (Number(meal.fats) || 0),
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      }
    );

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    window.location.href = "/clients";
  };

  const openCreateProgram = () => {
    setProgramForm({
      name: "",
      description: "",
    });

    setProgramModal(true);
  };

  const createProgram = async () => {
    if (!programForm.name.trim()) {
      alert("اكتب اسم البرنامج التدريبي");
      return;
    }

    try {
      setSaving(true);

      await apiRequest("/training", {
        method: "POST",

        body: JSON.stringify({
          client_id: Number(clientId),
          name: programForm.name.trim(),
          description:
            programForm.description.trim(),
        }),
      });

      setProgramModal(false);

      await loadClient();

      alert(
        "تم إنشاء البرنامج التدريبي بنجاح"
      );
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const openAddDay = (program) => {
    setNewDayModal(program);

    setNewDayForm({
      name: "",
    });
  };

  const addDay = async () => {
    if (
      !newDayModal ||
      !newDayForm.name.trim()
    ) {
      alert("اكتب اسم اليوم أولًا");
      return;
    }

    try {
      setSaving(true);

      const result = await apiRequest(
        `/training-days/program/${newDayModal.id}`,
        {
          method: "POST",

          body: JSON.stringify({
            name:
              newDayForm.name.trim(),
          }),
        }
      );

      setNewDayModal(null);

      await loadClient();

      if (result.dayId) {
        setExpandedDays(
          (previous) => ({
            ...previous,
            [result.dayId]: true,
          })
        );
      }
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditDay = (day) => {
    setEditingDay(day);

    setDayForm({
      day_number: day.day_number ?? "",
      name: day.name || "",
    });
  };

  const saveDay = async () => {
    if (
      !editingDay ||
      !dayForm.name.trim()
    ) {
      alert("اسم اليوم مطلوب");
      return;
    }

    try {
      setSaving(true);

      await apiRequest(
        `/training-days/${editingDay.id}`,
        {
          method: "PUT",

          body: JSON.stringify({
            day_number: Number(
              dayForm.day_number || 1
            ),
            name: dayForm.name.trim(),
          }),
        }
      );

      setEditingDay(null);

      await loadClient();
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDay = async (day) => {
    if (
      !window.confirm(
        `حذف "${day.name}" وجميع التمارين الموجودة بداخله؟`
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      await apiRequest(
        `/training-days/${day.id}`,
        {
          method: "DELETE",
        }
      );

      await loadClient();
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const loadExerciseLibrary = async () => {
    try {
      setLibraryLoading(true);

      const result = await apiRequest(
        "/exercises/library"
      );

      setExerciseLibrary(
        Array.isArray(result.exercises)
          ? result.exercises
          : []
      );
    } catch (requestError) {
      console.error(
        "EXERCISE LIBRARY ERROR:",
        requestError
      );
    } finally {
      setLibraryLoading(false);
    }
  };

  const resetExerciseVideoInput =
    () => {
      setExerciseVideoFile(null);

      if (
        exerciseVideoInputRef.current
      ) {
        exerciseVideoInputRef.current.value =
          "";
      }
    };

  const openAddExercise = async (day) => {
    setEditingExercise(null);

    setTrainingModal({
      type: "addExercise",
      day,
    });

    setExerciseForm({
      ...emptyExercise(),

      exercise_order: String(
        (day.exercises || []).length + 1
      ),
    });

    setExerciseSearch("");

    resetExerciseVideoInput();

    await loadExerciseLibrary();
  };

  const startEditExercise = async (
    exercise,
    day
  ) => {
    setEditingExercise(exercise);

    setTrainingModal({
      type: "editExercise",
      day,
    });

    setExerciseForm({
      name: exercise.name || "",

      description:
        exercise.description || "",

      sets: exercise.sets ?? "",

      reps: exercise.reps || "",

      rest_seconds:
        exercise.rest_seconds ?? "",

      video_url:
        exercise.video_url || "",

      exercise_order:
        exercise.exercise_order ?? "",
    });

    setExerciseSearch("");

    resetExerciseVideoInput();

    await loadExerciseLibrary();
  };

  const uploadExerciseVideo = async (
    exerciseId,
    file
  ) => {
    if (!exerciseId || !file) {
      return null;
    }

    const formData = new FormData();

    formData.append(
      "exercise_id",
      String(exerciseId)
    );

    formData.append(
      "video",
      file
    );

    const token = getToken();

    const response = await fetch(
      `${API_URL}/exercise-videos/upload`,
      {
        method: "POST",

        headers: {
          Accept:
            "application/json",

          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`,
              }
            : {}),
        },

        body: formData,
      }
    );

    const result =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message ||
          "حدث خطأ أثناء رفع فيديو التمرين"
      );
    }

    return result;
  };

  const handleExerciseVideoChange =
    (event) => {
      const file =
        event.target.files?.[0] ||
        null;

      if (!file) {
        setExerciseVideoFile(null);
        return;
      }

      const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
      ];

      if (
        !allowedTypes.includes(
          file.type
        )
      ) {
        event.target.value = "";

        setExerciseVideoFile(null);

        alert(
          "نوع الفيديو غير مسموح. استخدم MP4 أو WebM أو MOV أو AVI."
        );

        return;
      }

      if (
        file.size >
        100 * 1024 * 1024
      ) {
        event.target.value = "";

        setExerciseVideoFile(null);

        alert(
          "حجم الفيديو يجب ألا يتجاوز 100 ميجابايت."
        );

        return;
      }

      setExerciseVideoFile(file);
    };

  const saveExercise = async () => {
    if (!exerciseForm.name.trim()) {
      alert("اسم التمرين مطلوب");
      return;
    }

    let createdExerciseId =
      editingExercise?.id || null;

    const hasVideoFile =
      Boolean(exerciseVideoFile);

    try {
      setSaving(true);

      const body = {
        name:
          exerciseForm.name.trim(),

        description:
          exerciseForm.description.trim(),

        sets: toNumberOrNull(
          exerciseForm.sets
        ),

        reps:
          exerciseForm.reps.trim(),

        rest_seconds:
          toNumberOrNull(
            exerciseForm.rest_seconds
          ),

        video_url:
          hasVideoFile
            ? editingExercise?.video_url ||
              ""
            : exerciseForm.video_url.trim(),

        exercise_order:
          toNumberOrNull(
            exerciseForm.exercise_order
          ) || 1,
      };

      if (editingExercise) {
        await apiRequest(
          `/exercises/${editingExercise.id}`,
          {
            method: "PUT",

            body: JSON.stringify(body),
          }
        );
      } else {
        const result =
          await apiRequest(
            `/exercises/day/${trainingModal.day.id}`,
            {
              method: "POST",

              body: JSON.stringify(
                body
              ),
            }
          );

        createdExerciseId =
          result.exerciseId;
      }

      if (
        hasVideoFile &&
        createdExerciseId
      ) {
        setVideoUploading(true);

        await uploadExerciseVideo(
          createdExerciseId,
          exerciseVideoFile
        );
      }

      setTrainingModal(null);
      setEditingExercise(null);

      setExerciseForm(
        emptyExercise()
      );

      resetExerciseVideoInput();

      await loadClient();

      alert(
        hasVideoFile
          ? editingExercise
            ? "تم تعديل التمرين ورفع الفيديو بنجاح"
            : "تم إضافة التمرين ورفع الفيديو بنجاح"
          : editingExercise
          ? "تم تعديل التمرين"
          : "تم إضافة التمرين"
      );
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
      setVideoUploading(false);
    }
  };

  const deleteExerciseVideo =
    async (exercise) => {
      if (
        !exercise?.id ||
        !exercise?.video_url
      ) {
        alert(
          "لا يوجد فيديو لهذا التمرين"
        );

        return;
      }

      const confirmed =
        window.confirm(
          `هل تريد حذف فيديو تمرين "${exercise.name}"؟`
        );

      if (!confirmed) {
        return;
      }

      try {
        setSaving(true);

        await apiRequest(
          `/exercise-videos/${exercise.id}`,
          {
            method: "DELETE",
          }
        );

        setExerciseForm(
          (previous) => ({
            ...previous,
            video_url: "",
          })
        );

        await loadClient();

        alert(
          "تم حذف فيديو التمرين بنجاح"
        );
      } catch (requestError) {
        alert(requestError.message);
      } finally {
        setSaving(false);
      }
    };

  const deleteExercise = async (
    exercise
  ) => {
    if (
      !window.confirm(
        `حذف تمرين "${exercise.name}"؟`
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      await apiRequest(
        `/exercises/${exercise.id}`,
        {
          method: "DELETE",
        }
      );

      await loadClient();
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const duplicateDay = async (day) => {
    try {
      setSaving(true);

      const result =
        await apiRequest(
          `/training-days/${day.id}/duplicate`,
          {
            method: "POST",

            body: JSON.stringify({
              name: `${
                day.name || "اليوم"
              } - نسخة`,
            }),
          }
        );

      await loadClient();

      if (result.dayId) {
        setExpandedDays(
          (previous) => ({
            ...previous,
            [result.dayId]: true,
          })
        );
      }
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredLibrary =
    exerciseLibrary.filter(
      (exercise) =>
        exercise.name
          ?.toLowerCase()
          .includes(
            exerciseSearch
              .trim()
              .toLowerCase()
          )
    );

  const selectLibraryExercise =
    (exercise) => {
      setExerciseForm(
        (previous) => ({
          ...previous,

          name:
            exercise.name || "",

          description:
            exercise.description || "",

          sets:
            exercise.sets ??
            previous.sets,

          reps:
            exercise.reps ??
            previous.reps,

          rest_seconds:
            exercise.rest_seconds ??
            previous.rest_seconds,

          video_url:
            exercise.video_url ||
            previous.video_url,
        })
      );
    };

  const openAddNutrition = () => {
    setNutritionForm(
      emptyNutrition()
    );

    setEditingNutritionPlan(null);

    setShowNutritionForm(true);
  };

  const closeNutritionForm = () => {
    setShowNutritionForm(false);
    setEditingNutritionPlan(null);
    setNutritionForm(
      emptyNutrition()
    );
  };

  const startEditNutrition =
    (plan) => {
      setNutritionForm({
        name:
          plan.name ||
          plan.title ||
          "",

        description:
          plan.description || "",

        meals:
          Array.isArray(
            plan.meals
          ) &&
          plan.meals.length
            ? plan.meals.map(
                (meal) => ({
                  name:
                    meal.name ||
                    meal.meal_name ||
                    "",

                  description:
                    meal.description ||
                    "",

                  calories:
                    meal.calories ??
                    "",

                  protein:
                    meal.protein ??
                    "",

                  carbs:
                    meal.carbs ??
                    "",

                  fats:
                    meal.fats ??
                    "",
                })
              )
            : [emptyMeal()],
      });

      setEditingNutritionPlan(plan);

      setShowNutritionForm(true);
    };

  const updateNutritionMeal = (
    index,
    field,
    value
  ) => {
    setNutritionForm(
      (previous) => ({
        ...previous,

        meals:
          previous.meals.map(
            (meal, mealIndex) =>
              mealIndex === index
                ? {
                    ...meal,
                    [field]:
                      value,
                  }
                : meal
          ),
      })
    );
  };

  const addNutritionMeal = (
    sourceIndex = null
  ) => {
    setNutritionForm(
      (previous) => {
        const source =
          sourceIndex !== null
            ? previous.meals[
                sourceIndex
              ]
            : null;

        const meal = source
          ? { ...source }
          : emptyMeal();

        return {
          ...previous,

          meals: [
            ...previous.meals,
            meal,
          ],
        };
      }
    );
  };

  const removeNutritionMeal =
    (index) => {
      setNutritionForm(
        (previous) => {
          if (
            previous.meals.length <= 1
          ) {
            alert(
              "يجب أن يحتوي النظام على وجبة واحدة على الأقل"
            );

            return previous;
          }

          return {
            ...previous,

            meals:
              previous.meals.filter(
                (_, i) =>
                  i !== index
              ),
          };
        }
      );
    };

  const saveNutrition = async () => {
    const name =
      nutritionForm.name.trim();

    const meals =
      nutritionForm.meals.filter(
        (meal) =>
          meal.name.trim()
      );

    if (!name) {
      alert(
        "اكتب اسم النظام الغذائي"
      );
      return;
    }

    if (!meals.length) {
      alert(
        "أضف وجبة واحدة على الأقل"
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        client_id: Number(clientId),

        name,

        description:
          nutritionForm.description.trim(),

        meals: meals.map(
          (meal) => ({
            name:
              meal.name.trim(),

            description:
              meal.description.trim(),

            calories:
              meal.calories,

            protein:
              meal.protein,

            carbs:
              meal.carbs,

            fats:
              meal.fats,
          })
        ),
      };

      if (editingNutritionPlan) {
        await apiRequest(
          `/nutrition/${editingNutritionPlan.id}`,
          {
            method: "PUT",

            body: JSON.stringify(
              payload
            ),
          }
        );
      } else {
        await apiRequest(
          "/nutrition",
          {
            method: "POST",

            body: JSON.stringify(
              payload
            ),
          }
        );
      }

      closeNutritionForm();

      await loadClient();

      alert(
        editingNutritionPlan
          ? "تم تعديل النظام الغذائي"
          : "تم إضافة النظام الغذائي"
      );
    } catch (requestError) {
      alert(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNutritionPlan =
    async (plan) => {
      if (
        !window.confirm(
          `حذف النظام الغذائي "${plan.name}" وجميع وجباته؟`
        )
      ) {
        return;
      }

      try {
        setSaving(true);

        await apiRequest(
          `/nutrition/${plan.id}`,
          {
            method: "DELETE",
          }
        );

        await loadClient();
      } catch (requestError) {
        alert(requestError.message);
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <div
        className="client-details-page"
        dir="rtl"
      >
        <div className="client-details-loading">
          <div className="client-loading-icon">
            G
          </div>

          <h2>
            جاري تحميل ملف العميل...
          </h2>

          <p>
            يتم تجهيز بيانات العميل.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="client-details-page"
        dir="rtl"
      >
        <div className="client-details-error-card">
          <div className="error-icon">
            !
          </div>

          <h2>
            تعذر تحميل ملف العميل
          </h2>

          <p>{error}</p>

          <small>
            رقم العميل:{" "}
            {clientId || "غير موجود"}
          </small>

          <div className="client-details-error-actions">
            <button
              type="button"
              onClick={loadClient}
            >
              إعادة المحاولة
            </button>

            <button
              type="button"
              onClick={goBack}
            >
              العودة للعملاء
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="client-details-page"
      dir="rtl"
    >
      <header className="client-details-header">
        <div>
          <span className="client-details-eyebrow">
            GYM COACH / CLIENT PROFILE
          </span>

          <h1>ملف العميل</h1>

          <p>
            إدارة بيانات العميل والتدريب والتغذية
            بطريقة بسيطة وواضحة.
          </p>
        </div>

        <div className="client-details-header-actions">
          <button
            type="button"
            onClick={loadClient}
            disabled={saving}
          >
            تحديث
          </button>

          <button
            type="button"
            onClick={goBack}
          >
            العملاء
          </button>
        </div>
      </header>

      <section className="client-profile-card">
        <div className="client-avatar">
          {(client.name || "ع").charAt(0)}
        </div>

        <div className="client-profile-main">
          <span className="section-label">
            العميل
          </span>

          <h2>
            {client.name || "عميل"}
          </h2>

          <p>
            {client.email ||
              "بدون بريد إلكتروني"}
          </p>
                <p className="client-phone">
          {client.phone
            ? `رقم الموبايل: ${client.phone}`
            : "رقم الموبايل: غير مسجل"}
        </p>

          <small>
            رقم العميل #{client.id || clientId}
          </small>
        </div>

        <div className="client-status-box">
          <span>حالة الاشتراك</span>

          <strong
            className={`client-status status-${
              subscription?.status ||
              "unknown"
            }`}
          >
            {statusLabels[
              subscription?.status
            ] ||
              subscription?.status ||
              "غير محدد"}
          </strong>
        </div>
      </section>

      {activeSection === "overview" && (
        <>
          <section className="main-client-actions">
            <button
              type="button"
              className="main-action training-action"
              onClick={() =>
                setActiveSection("training")
              }
            >
              <div className="main-action-icon">
                🏋️
              </div>

              <div>
                <span>TRAINING</span>

                <strong>التدريب</strong>

                <small>
                  إدارة البرنامج والأيام والتمارين
                </small>
              </div>

              <b>←</b>
            </button>

            <button
              type="button"
              className="main-action nutrition-action"
              onClick={() =>
                setActiveSection("nutrition")
              }
            >
              <div className="main-action-icon">
                🥗
              </div>

              <div>
                <span>NUTRITION</span>

                <strong>التغذية</strong>

                <small>
                  إدارة النظام الغذائي والوجبات
                </small>
              </div>

              <b>←</b>
            </button>
          </section>

          <section className="client-stats-grid">
            <div className="client-stat-card">
              <span>الباقة الحالية</span>

              <strong>
                {subscription?.package_name ||
                  "بدون باقة"}
              </strong>
            </div>

            <div className="client-stat-card">
              <span>سعر الباقة</span>

              <strong>
                {formatMoney(
                  subscription?.package_price
                )}
              </strong>
            </div>

            <div className="client-stat-card">
              <span>الأيام المتبقية</span>

              <strong>
                {daysRemaining === null
                  ? "—"
                  : daysRemaining}
              </strong>
            </div>

            <div className="client-stat-card">
              <span>إجمالي التمارين</span>

              <strong>
                {totalExercises}
              </strong>
            </div>
          </section>

          <section className="client-details-panel">
            <div className="panel-heading">
              <div>
                <span>
                  CLIENT INFORMATION
                </span>

                <h2>بيانات العميل</h2>
              </div>
            </div>

            <div className="client-info-grid">
              <div>
                <span>الاسم</span>

                <strong>
                  {client.name || "—"}
                </strong>
              </div>

              <div>
                <span>
                  البريد الإلكتروني
                </span>

                <strong>
                  {client.email || "—"}
                </strong>
              </div>

              <div>
                <span>تاريخ التسجيل</span>

                <strong>
                  {formatDate(
                    client.created_at
                  )}
                </strong>
              </div>

              <div>
                <span>بداية الاشتراك</span>

                <strong>
                  {formatDate(
                    subscription?.start_date
                  )}
                </strong>
              </div>

              <div>
                <span>نهاية الاشتراك</span>

                <strong>
                  {formatDate(
                    subscription?.end_date
                  )}
                </strong>
              </div>

              <div>
                <span>مدة الباقة</span>

                <strong>
                  {subscription?.duration_days
                    ? `${subscription.duration_days} يوم`
                    : "—"}
                </strong>
              </div>
            </div>
          </section>

          <section className="client-details-panel">
            <div className="panel-heading progress-heading">
              <div>
                <span>
                  TRAINING PROGRESS
                </span>

                <h2>مستوى التقدم</h2>
              </div>

              <strong>
                {progressPercentage}%
              </strong>
            </div>

            <div className="progress-bar">
              <span
                style={{
                  width: `${progressPercentage}%`,
                }}
              />
            </div>

            <div className="progress-footer">
              <span>
                {completedExercises} تمرين مكتمل
              </span>

              <span>
                من أصل {totalExercises}
              </span>
            </div>
          </section>

          <section className="client-details-panel subscription-panel">
            <div className="panel-heading">
              <div>
                <span>SUBSCRIPTION</span>

                <h2>الاشتراك الحالي</h2>
              </div>
            </div>

            {subscription ? (
              <div className="subscription-summary">
                <div>
                  <span>الباقة</span>

                  <strong>
                    {subscription.package_name ||
                      "باقة"}
                  </strong>
                </div>

                <div>
                  <span>البداية</span>

                  <strong>
                    {formatDate(
                      subscription.start_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>النهاية</span>

                  <strong>
                    {formatDate(
                      subscription.end_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>الحالة</span>

                  <strong>
                    {statusLabels[
                      subscription.status
                    ] ||
                      subscription.status ||
                      "—"}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                لا يوجد اشتراك حالي.
              </div>
            )}
          </section>
        </>
      )}

      {activeSection === "training" && (
        <section className="client-details-panel section-page">
          <div className="section-page-header">
            <div>
              <span>
                TRAINING MANAGEMENT
              </span>

              <h2>التدريب</h2>

              <p>
                البرنامج التدريبي الخاص بالعميل.
              </p>
            </div>

            <div className="section-header-actions">
              <button
                type="button"
                className="gold-button small"
                onClick={openCreateProgram}
              >
                + إنشاء نظام جديد
              </button>

              <button
                type="button"
                className="back-to-client"
                onClick={() =>
                  setActiveSection("overview")
                }
              >
                ← ملف العميل
              </button>
            </div>
          </div>

          {!currentProgram ? (
            <div className="large-empty-state">
              <div>🏋️</div>

              <h3>
                لا يوجد برنامج تدريبي
              </h3>

              <p>
                ابدأ بإنشاء البرنامج الأول للعميل.
              </p>

              <button
                type="button"
                className="gold-button"
                onClick={openCreateProgram}
              >
                إنشاء البرنامج
              </button>
            </div>
          ) : (
            <div className="training-editor">
              <div className="program-title-card">
                <div>
                  <span>PROGRAM</span>

                  <h3>
                    {currentProgram.name ||
                      "برنامج تدريبي"}
                  </h3>

                  {currentProgram.description && (
                    <p>
                      {currentProgram.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="gold-button small"
                  onClick={() =>
                    openAddDay(
                      currentProgram
                    )
                  }
                >
                  + إضافة يوم
                </button>
              </div>

              {(currentProgram.days || []).map(
                (day) => {
                  const expanded =
                    Boolean(
                      expandedDays[day.id]
                    );

                  return (
                    <article
                      className={`training-day ${
                        expanded
                          ? "expanded"
                          : ""
                      }`}
                      key={day.id}
                    >
                      <div
                        className="training-day-header"
                        onClick={() =>
                          setExpandedDays(
                            (previous) => ({
                              ...previous,
                              [day.id]:
                                !expanded,
                            })
                          )
                        }
                      >
                        <div className="day-info">
                          <span className="day-number">
                            {day.day_number}
                          </span>

                          <div>
                            <h4>
                              {day.name ||
                                "يوم تدريب"}
                            </h4>

                            <small>
                              {(day.exercises || [])
                                .length}{" "}
                              تمارين
                            </small>
                          </div>
                        </div>

                        <div
                          className="day-actions"
                          onClick={(event) =>
                            event.stopPropagation()
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openAddExercise(
                                day
                              )
                            }
                          >
                            + تمرين
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              duplicateDay(
                                day
                              )
                            }
                          >
                            نسخ
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              startEditDay(
                                day
                              )
                            }
                          >
                            تعديل
                          </button>

                          <button
                            type="button"
                            className="danger-text"
                            onClick={() =>
                              deleteDay(
                                day
                              )
                            }
                            disabled={saving}
                          >
                            حذف
                          </button>

                          <span className="day-chevron">
                            {expanded
                              ? "⌃"
                              : "⌄"}
                          </span>
                        </div>
                      </div>

                      {expanded && (
                        <div className="training-day-body">
                          {(day.exercises || [])
                            .length ? (
                            (day.exercises || []).map(
                              (
                                exercise,
                                index
                              ) => (
                                <div
                                  className="exercise-row"
                                  key={
                                    exercise.id
                                  }
                                >
                                  <div className="exercise-index">
                                    {exercise.exercise_order ||
                                      index + 1}
                                  </div>

                                  <div className="exercise-info">
                                    <strong>
                                      {
                                        exercise.name
                                      }
                                    </strong>

                                    {exercise.description && (
                                      <p>
                                        {
                                          exercise.description
                                        }
                                      </p>
                                    )}

                                    <div className="exercise-meta">
                                      {exercise.sets !=
                                        null && (
                                        <span>
                                          {
                                            exercise.sets
                                          }{" "}
                                          مجموعات
                                        </span>
                                      )}

                                      {exercise.reps && (
                                        <span>
                                          {
                                            exercise.reps
                                          }{" "}
                                          تكرار
                                        </span>
                                      )}

                                      {exercise.rest_seconds !=
                                        null && (
                                        <span>
                                          {
                                            exercise.rest_seconds
                                          }{" "}
                                          ثانية راحة
                                        </span>
                                      )}

                                      {exercise.video_url && (
                                        <span>
                                          🎬 فيديو
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="exercise-actions">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditExercise(
                                          exercise,
                                          day
                                        )
                                      }
                                    >
                                      تعديل
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-text"
                                      onClick={() =>
                                        deleteExercise(
                                          exercise
                                        )
                                      }
                                      disabled={saving}
                                    >
                                      حذف
                                    </button>
                                  </div>
                                </div>
                              )
                            )
                          ) : (
                            <div className="empty-day">
                              لا توجد تمارين في هذا اليوم.

                              <button
                                type="button"
                                className="gold-button small"
                                onClick={() =>
                                  openAddExercise(
                                    day
                                  )
                                }
                              >
                                إضافة تمرين
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }
              )}

              {!(currentProgram.days || [])
                .length && (
                <div className="large-empty-state compact">
                  <h3>
                    لا توجد أيام تدريب
                  </h3>

                  <button
                    type="button"
                    className="gold-button"
                    onClick={() =>
                      openAddDay(
                        currentProgram
                      )
                    }
                  >
                    إضافة أول يوم
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeSection === "training" &&
        programs.length > 1 && (
          <section className="client-details-panel training-archive-panel">
            <div className="section-page-header">
              <div>
                <span>
                  TRAINING ARCHIVE
                </span>

                <h2>
                  الأنظمة التدريبية المحفوظة
                </h2>

                <p>
                  الأنظمة السابقة محفوظة للمدرب فقط ولا تظهر للعميل.
                </p>
              </div>
            </div>

            <div className="training-archive-list">
              {programs.slice(1).map(
                (program) => (
                  <article
                    className="training-archive-card"
                    key={program.id}
                  >
                    <div className="training-archive-info">
                      <span>
                        محفوظ للمدرب
                      </span>

                      <h3>
                        {program.name ||
                          "برنامج تدريبي"}
                      </h3>

                      {program.description && (
                        <p>
                          {program.description}
                        </p>
                      )}

                      <small>
                        تم الإنشاء:{" "}
                        {formatDate(
                          program.created_at
                        )}
                      </small>
                    </div>

                    <button
                      type="button"
                      className="back-to-client"
                      onClick={() =>
                        setArchivedProgram(
                          program
                        )
                      }
                    >
                      عرض النظام
                    </button>
                  </article>
                )
              )}
            </div>
          </section>
        )}

      {archivedProgram && (
        <Modal
          title={
            archivedProgram.name ||
            "النظام التدريبي المحفوظ"
          }
          eyebrow="TRAINING ARCHIVE"
          large
          onClose={() =>
            setArchivedProgram(null)
          }
        >
          <div className="archived-program-view">
            <div className="archived-program-meta">
              <strong>
                هذا النظام محفوظ للمدرب فقط
              </strong>

              <span>
                العميل يرى النظام النشط الأحدث فقط.
              </span>
            </div>

            {archivedProgram.description && (
              <p className="archived-program-description">
                {archivedProgram.description}
              </p>
            )}

            {(archivedProgram.days || [])
              .length === 0 ? (
              <div className="large-empty-state compact">
                لا توجد أيام محفوظة داخل هذا النظام.
              </div>
            ) : (
              <div className="archived-days-list">
                {(archivedProgram.days || []).map(
                  (day) => (
                    <article
                      className="archived-day-card"
                      key={day.id}
                    >
                      <div>
                        <strong>
                          اليوم{" "}
                          {day.day_number}:{" "}
                          {day.name ||
                            "يوم تدريب"}
                        </strong>

                        <span>
                          {(day.exercises || [])
                            .length}{" "}
                          تمارين
                        </span>
                      </div>

                      {(day.exercises || [])
                        .length > 0 && (
                        <ul>
                          {(day.exercises || []).map(
                            (exercise) => (
                              <li
                                key={
                                  exercise.id
                                }
                              >
                                <strong>
                                  {
                                    exercise.name
                                  }
                                </strong>

                                {exercise.sets ||
                                exercise.reps ? (
                                  <span>
                                    {exercise.sets
                                      ? `${exercise.sets} مجموعات`
                                      : ""}

                                    {exercise.sets &&
                                    exercise.reps
                                      ? " • "
                                      : ""}

                                    {exercise.reps
                                      ? `${exercise.reps} تكرار`
                                      : ""}
                                  </span>
                                ) : null}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {activeSection === "nutrition" && (
        <section className="client-details-panel section-page">
          <div className="section-page-header">
            <div>
              <span>
                NUTRITION MANAGEMENT
              </span>

              <h2>التغذية</h2>

              <p>
                النظام الغذائي والوجبات الخاصة بالعميل.
              </p>
            </div>

            <div className="section-header-actions">
              <button
                type="button"
                className="gold-button small"
                onClick={
                  openAddNutrition
                }
              >
                + إضافة نظام
              </button>

              <button
                type="button"
                className="back-to-client"
                onClick={() =>
                  setActiveSection("overview")
                }
              >
                ← ملف العميل
              </button>
            </div>
          </div>

          {nutritionPlans.length === 0 ? (
            <div className="large-empty-state">
              <div>🥗</div>

              <h3>
                لا يوجد نظام غذائي
              </h3>

              <p>
                ابدأ بإنشاء النظام الغذائي الخاص بالعميل.
              </p>

              <button
                type="button"
                className="gold-button"
                onClick={
                  openAddNutrition
                }
              >
                إنشاء النظام الغذائي
              </button>
            </div>
          ) : (
            <div className="nutrition-list">
              {nutritionPlans.map((plan) => {
                const totals =
                  nutritionTotals(
                    plan.meals || []
                  );

                const expanded =
                  Boolean(
                    expandedNutrition[
                      plan.id
                    ]
                  );

                return (
                  <article
                    className={`nutrition-card ${
                      expanded
                        ? "expanded"
                        : ""
                    }`}
                    key={plan.id}
                  >
                    <div
                      className="nutrition-card-header"
                      onClick={() =>
                        setExpandedNutrition(
                          (previous) => ({
                            ...previous,
                            [plan.id]:
                              !expanded,
                          })
                        )
                      }
                    >
                      <div>
                        <span>
                          NUTRITION PLAN
                        </span>

                        <h3>
                          {plan.name ||
                            plan.title ||
                            "النظام الغذائي"}
                        </h3>

                        {plan.description && (
                          <p>
                            {
                              plan.description
                            }
                          </p>
                        )}
                      </div>

                      <div
                        className="nutrition-actions"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            startEditNutrition(
                              plan
                            )
                          }
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          className="danger-text"
                          onClick={() =>
                            deleteNutritionPlan(
                              plan
                            )
                          }
                          disabled={saving}
                        >
                          حذف
                        </button>

                        <span>
                          {expanded
                            ? "⌃"
                            : "⌄"}
                        </span>
                      </div>
                    </div>

                    <div className="nutrition-summary">
                      <div>
                        <strong>
                          {Math.round(
                            totals.calories
                          )}
                        </strong>

                        <span>
                          سعرة
                        </span>
                      </div>

                      <div>
                        <strong>
                          {Math.round(
                            totals.protein
                          )}
                        </strong>

                        <span>
                          بروتين
                        </span>
                      </div>

                      <div>
                        <strong>
                          {Math.round(
                            totals.carbs
                          )}
                        </strong>

                        <span>
                          كارب
                        </span>
                      </div>

                      <div>
                        <strong>
                          {Math.round(
                            totals.fats
                          )}
                        </strong>

                        <span>
                          دهون
                        </span>
                      </div>
                    </div>

                    {expanded && (
                      <div className="nutrition-meals">
                        {(plan.meals || []).map(
                          (meal, index) => (
                            <div
                              className="meal-row"
                              key={
                                meal.id ||
                                `${plan.id}-${index}`
                              }
                            >
                              <div className="meal-number">
                                {index + 1}
                              </div>

                              <div>
                                <strong>
                                  {meal.name ||
                                    meal.meal_name ||
                                    "وجبة"}
                                </strong>

                                {meal.description && (
                                  <p>
                                    {
                                      meal.description
                                    }
                                  </p>
                                )}

                                <div className="meal-meta">
                                  {meal.calories !=
                                    null &&
                                    meal.calories !==
                                      "" && (
                                      <span>
                                        {
                                          meal.calories
                                        }{" "}
                                        سعرة
                                      </span>
                                    )}

                                  {meal.protein !=
                                    null &&
                                    meal.protein !==
                                      "" && (
                                      <span>
                                        بروتين{" "}
                                        {
                                          meal.protein
                                        }{" "}
                                        جم
                                      </span>
                                    )}

                                  {meal.carbs !=
                                    null &&
                                    meal.carbs !==
                                      "" && (
                                      <span>
                                        كارب{" "}
                                        {
                                          meal.carbs
                                        }{" "}
                                        جم
                                      </span>
                                    )}

                                  {meal.fats !=
                                    null &&
                                    meal.fats !==
                                      "" && (
                                      <span>
                                        دهون{" "}
                                        {
                                          meal.fats
                                        }{" "}
                                        جم
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          CREATE PROGRAM MODAL
      ===================================================== */}

      {programModal && (
        <Modal
          title="إنشاء برنامج تدريبي"
          eyebrow="CREATE TRAINING PROGRAM"
          onClose={() =>
            setProgramModal(false)
          }
        >
          <div className="client-modal-form-grid">
            <label>
              اسم البرنامج

              <input
                value={programForm.name}
                onChange={(event) =>
                  setProgramForm(
                    (previous) => ({
                      ...previous,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="مثال: تضخيم 5 أيام"
                autoFocus
              />
            </label>

            <label>
              العميل

              <input
                value={
                  client.name ||
                  `العميل #${clientId}`
                }
                disabled
              />
            </label>
          </div>

          <label>
            وصف البرنامج

            <textarea
              rows="3"
              value={
                programForm.description
              }
              onChange={(event) =>
                setProgramForm(
                  (previous) => ({
                    ...previous,
                    description:
                      event.target.value,
                  })
                )
              }
            />
          </label>

          <div className="client-modal-actions">
            <button
              type="button"
              onClick={() =>
                setProgramModal(false)
              }
            >
              إلغاء
            </button>

            <button
              type="button"
              className="gold-button"
              onClick={createProgram}
              disabled={saving}
            >
              {saving
                ? "جاري..."
                : "إنشاء البرنامج"}
            </button>
          </div>
        </Modal>
      )}

      {/* =====================================================
          ADD DAY MODAL
      ===================================================== */}

      {newDayModal && (
        <Modal
          title="إضافة يوم تدريبي"
          eyebrow="ADD TRAINING DAY"
          onClose={() =>
            setNewDayModal(null)
          }
        >
          <div className="client-modal-form-grid">
            <label>
              اسم اليوم

              <input
                value={newDayForm.name}
                onChange={(event) =>
                  setNewDayForm({
                    name:
                      event.target.value,
                  })
                }
                placeholder="مثال: صدر وترايسبس"
                autoFocus
              />
            </label>

            <label>
              البرنامج

              <input
                value={
                  newDayModal.name ||
                  "برنامج تدريبي"
                }
                disabled
              />
            </label>
          </div>

          <div className="client-modal-actions">
            <button
              type="button"
              onClick={() =>
                setNewDayModal(null)
              }
            >
              إلغاء
            </button>

            <button
              type="button"
              className="gold-button"
              onClick={addDay}
              disabled={saving}
            >
              {saving
                ? "جاري..."
                : "إضافة اليوم"}
            </button>
          </div>
        </Modal>
      )}

      {/* =====================================================
          EDIT DAY MODAL
      ===================================================== */}

      {editingDay && (
        <Modal
          title="تعديل اليوم"
          eyebrow="EDIT TRAINING DAY"
          onClose={() =>
            setEditingDay(null)
          }
        >
          <div className="client-modal-form-grid">
            <label>
              رقم اليوم

              <input
                type="number"
                min="1"
                value={
                  dayForm.day_number
                }
                onChange={(event) =>
                  setDayForm(
                    (previous) => ({
                      ...previous,
                      day_number:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              اسم اليوم

              <input
                value={
                  dayForm.name
                }
                onChange={(event) =>
                  setDayForm(
                    (previous) => ({
                      ...previous,
                      name:
                        event.target.value,
                    })
                  )
                }
              />
            </label>
          </div>

          <div className="client-modal-actions">
            <button
              type="button"
              onClick={() =>
                setEditingDay(null)
              }
            >
              إلغاء
            </button>

            <button
              type="button"
              className="gold-button"
              onClick={saveDay}
              disabled={saving}
            >
              حفظ التعديل
            </button>
          </div>
        </Modal>
      )}

      {/* =====================================================
          EXERCISE MODAL
      ===================================================== */}

      {trainingModal && (
        <Modal
          title={
            editingExercise
              ? "تعديل التمرين"
              : "إضافة تمرين"
          }
          eyebrow={
            editingExercise
              ? "EDIT EXERCISE"
              : "ADD EXERCISE"
          }
          onClose={() => {
            setTrainingModal(null);
            setEditingExercise(null);
            resetExerciseVideoInput();
          }}
          large
        >
          {!editingExercise && (
            <div className="exercise-library">
              <div className="library-header">
                <div>
                  <span>
                    EXERCISE LIBRARY
                  </span>

                  <strong>
                    اختر تمرينًا جاهزًا
                  </strong>
                </div>

                {libraryLoading && (
                  <small>
                    جاري التحميل...
                  </small>
                )}
              </div>

              <input
                value={exerciseSearch}
                onChange={(event) =>
                  setExerciseSearch(
                    event.target.value
                  )
                }
                placeholder="ابحث عن تمرين..."
              />

              {filteredLibrary.length >
              0 ? (
                <div className="library-list">
                  {filteredLibrary
                    .slice(0, 10)
                    .map(
                      (exercise) => (
                        <button
                          type="button"
                          key={
                            exercise.id
                          }
                          onClick={() =>
                            selectLibraryExercise(
                              exercise
                            )
                          }
                        >
                          <strong>
                            {
                              exercise.name
                            }
                          </strong>

                          <span>
                            {exercise.sets
                              ? `${exercise.sets} مجموعات`
                              : ""}

                            {exercise.reps
                              ? ` • ${exercise.reps}`
                              : ""}
                          </span>
                        </button>
                      )
                    )}
                </div>
              ) : (
                <small>
                  لا توجد نتائج.
                </small>
              )}
            </div>
          )}

          <div className="client-modal-form-grid">
            <label>
              اسم التمرين

              <input
                value={
                  exerciseForm.name
                }
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      name:
                        event.target.value,
                    })
                  )
                }
                autoFocus={!editingExercise}
              />
            </label>

            <label>
              المجموعات

              <input
                type="number"
                min="0"
                value={exerciseForm.sets}
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      sets:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              التكرارات

              <input
                value={exerciseForm.reps}
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      reps:
                        event.target.value,
                    })
                  )
                }
                placeholder="10 أو 8-12"
              />
            </label>

            <label>
              الراحة بالثواني

              <input
                type="number"
                min="0"
                value={
                  exerciseForm.rest_seconds
                }
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      rest_seconds:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              الترتيب

              <input
                type="number"
                min="1"
                value={
                  exerciseForm.exercise_order
                }
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      exercise_order:
                        event.target.value,
                    })
                  )
                }
              />
            </label>

            <label>
              رابط الفيديو

              <input
                type="url"
                value={
                  exerciseForm.video_url
                }
                onChange={(event) =>
                  setExerciseForm(
                    (previous) => ({
                      ...previous,
                      video_url:
                        event.target.value,
                    })
                  )
                }
                placeholder="https://..."
                disabled={
                  Boolean(
                    exerciseVideoFile
                  )
                }
              />

              <small>
                يمكنك استخدام رابط فيديو خارجي بدلًا من رفع ملف.
              </small>
            </label>

            <label>
              إضافة فيديو من الجهاز

              <input
                ref={exerciseVideoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={
                  handleExerciseVideoChange
                }
              />

              <small>
                MP4 / WebM / MOV / AVI — الحد الأقصى 100MB.
              </small>

              {exerciseVideoFile && (
                <div className="exercise-video-file-selected">
                  <strong>
                    الفيديو المختار:
                  </strong>{" "}
                  {exerciseVideoFile.name}

                  <button
                    type="button"
                    onClick={
                      resetExerciseVideoInput
                    }
                  >
                    إزالة
                  </button>
                </div>
              )}
            </label>
          </div>

          {editingExercise?.video_url && (
            <div
              style={{
                marginTop: "15px",
                padding: "14px",
                borderRadius: "12px",
                background:
                  "rgba(255,255,255,0.04)",
                border:
                  "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                الفيديو الحالي
              </strong>

              <button
                type="button"
                className="danger-text"
                onClick={() =>
                  deleteExerciseVideo(
                    editingExercise
                  )
                }
                disabled={
                  saving ||
                  videoUploading
                }
              >
                🗑️ حذف الفيديو الحالي
              </button>

              <small
                style={{
                  display: "block",
                  marginTop: "8px",
                  opacity: 0.75,
                }}
              >
                بعد الحذف يمكنك اختيار نفس الملف مرة أخرى مباشرة.
              </small>
            </div>
          )}

          <label>
            وصف / ملاحظات

            <textarea
              rows="3"
              value={
                exerciseForm.description
              }
              onChange={(event) =>
                setExerciseForm(
                  (previous) => ({
                    ...previous,
                    description:
                      event.target.value,
                  })
                )
              }
            />
          </label>

          <div className="client-modal-actions">
            <button
              type="button"
              onClick={() => {
                setTrainingModal(null);
                setEditingExercise(null);
                resetExerciseVideoInput();
              }}
            >
              إلغاء
            </button>

            <button
              type="button"
              className="gold-button"
              onClick={saveExercise}
              disabled={
                saving ||
                videoUploading
              }
            >
              {videoUploading
                ? "جاري رفع الفيديو..."
                : saving
                ? "جاري الحفظ..."
                : editingExercise
                ? "حفظ التعديل"
                : "إضافة التمرين"}
            </button>
          </div>
        </Modal>
      )}

      {/* =====================================================
          NUTRITION MODAL
      ===================================================== */}

      {showNutritionForm && (
        <Modal
          title={
            editingNutritionPlan
              ? "تعديل النظام الغذائي"
              : "إضافة نظام غذائي"
          }
          eyebrow={
            editingNutritionPlan
              ? "EDIT NUTRITION PLAN"
              : "CREATE NUTRITION PLAN"
          }
          onClose={
            closeNutritionForm
          }
          large
        >
          <div className="client-modal-form-grid">
            <label>
              اسم النظام

              <input
                value={
                  nutritionForm.name
                }
                onChange={(event) =>
                  setNutritionForm(
                    (previous) => ({
                      ...previous,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="مثال: تنشيف 2200 سعرة"
                autoFocus
              />
            </label>

            <label>
              العميل

              <input
                value={
                  client.name ||
                  `العميل #${clientId}`
                }
                disabled
              />
            </label>
          </div>

          <label>
            وصف النظام

            <textarea
              rows="2"
              value={
                nutritionForm.description
              }
              onChange={(event) =>
                setNutritionForm(
                  (previous) => ({
                    ...previous,
                    description:
                      event.target.value,
                  })
                )
              }
            />
          </label>

          <div className="meal-builder-header">
            <div>
              <span>
                MEAL BUILDER
              </span>

              <h3>
                وجبات النظام
              </h3>
            </div>

            <button
              type="button"
              className="gold-button small"
              onClick={() =>
                addNutritionMeal()
              }
            >
              + إضافة وجبة
            </button>
          </div>

          <div className="meal-builder-list">
            {nutritionForm.meals.map(
              (meal, index) => (
                <div
                  className="meal-builder-card"
                  key={index}
                >
                  <div className="meal-builder-card-head">
                    <div>
                      <span>
                        MEAL {index + 1}
                      </span>

                      <strong>
                        وجبة رقم {index + 1}
                      </strong>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          addNutritionMeal(
                            index
                          )
                        }
                      >
                        نسخ الوجبة
                      </button>

                      <button
                        type="button"
                        className="danger-text"
                        onClick={() =>
                          removeNutritionMeal(
                            index
                          )
                        }
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  <div className="client-modal-form-grid">
                    <label>
                      اسم الوجبة

                      <input
                        value={
                          meal.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateNutritionMeal(
                            index,
                            "name",
                            event.target.value
                          )
                        }
                        placeholder="الإفطار"
                      />
                    </label>

                    <label>
                      السعرات

                      <input
                        type="number"
                        min="0"
                        value={
                          meal.calories
                        }
                        onChange={(
                          event
                        ) =>
                          updateNutritionMeal(
                            index,
                            "calories",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      البروتين

                      <input
                        type="number"
                        min="0"
                        value={
                          meal.protein
                        }
                        onChange={(
                          event
                        ) =>
                          updateNutritionMeal(
                            index,
                            "protein",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      الكربوهيدرات

                      <input
                        type="number"
                        min="0"
                        value={
                          meal.carbs
                        }
                        onChange={(
                          event
                        ) =>
                          updateNutritionMeal(
                            index,
                            "carbs",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      الدهون

                      <input
                        type="number"
                        min="0"
                        value={
                          meal.fats
                        }
                        onChange={(
                          event
                        ) =>
                          updateNutritionMeal(
                            index,
                            "fats",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    تفاصيل الوجبة

                    <textarea
                      rows="2"
                      value={
                        meal.description
                      }
                      onChange={(
                        event
                      ) =>
                        updateNutritionMeal(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="المكونات والكميات..."
                    />
                  </label>
                </div>
              )
            )}
          </div>

          <div className="live-nutrition-total">
            {(() => {
              const totals =
                nutritionTotals(
                  nutritionForm.meals
                );

              return (
                <>
                  <div>
                    <strong>
                      {Math.round(
                        totals.calories
                      )}
                    </strong>

                    <span>
                      سعرة
                    </span>
                  </div>

                  <div>
                    <strong>
                      {Math.round(
                        totals.protein
                      )}
                    </strong>

                    <span>
                      بروتين
                    </span>
                  </div>

                  <div>
                    <strong>
                      {Math.round(
                        totals.carbs
                      )}
                    </strong>

                    <span>
                      كارب
                    </span>
                  </div>

                  <div>
                    <strong>
                      {Math.round(
                        totals.fats
                      )}
                    </strong>

                    <span>
                      دهون
                    </span>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="client-modal-actions">
            <button
              type="button"
              onClick={
                closeNutritionForm
              }
            >
              إلغاء
            </button>

            <button
              type="button"
              className="gold-button"
              onClick={
                saveNutrition
              }
              disabled={saving}
            >
              {saving
                ? "جاري الحفظ..."
                : editingNutritionPlan
                ? "حفظ النظام"
                : "إنشاء النظام"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ClientDetails;