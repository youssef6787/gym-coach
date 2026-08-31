import API_URL from "../config/api";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

function ClientTraining() {
  const navigate = useNavigate();

  const [program, setProgram] = useState(null);
  const [progress, setProgress] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [protectedVideoUrls, setProtectedVideoUrls] =
    useState({});

  const [savingExercise, setSavingExercise] =
    useState(null);

  const [openDays, setOpenDays] = useState({});

  const [subscription, setSubscription] =
    useState(null);

  const [subscriptionLoading, setSubscriptionLoading] =
    useState(true);

  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    user = null;
  }

  const userName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    "العميل";

  /*
  ==================================================
  فتح أول يوم تلقائياً
  ==================================================
  */

  useEffect(() => {
    if (!program) {
      return;
    }

    const days =
      Array.isArray(program.days) &&
      program.days.length > 0
        ? program.days
        : weeksForOpenState(program);

    if (!days.length) {
      return;
    }

    const firstDay = days[0];

    const firstId =
      firstDay?._id || firstDay?.id;

    if (firstId != null) {
      setOpenDays((current) =>
        Object.keys(current).length
          ? current
          : {
              [String(firstId)]: true,
            }
      );
    }
  }, [program]);

  /*
  ==================================================
  تحميل فيديوهات التمارين المحمية
  ==================================================
  */

  useEffect(() => {
    let cancelled = false;

    async function loadProtectedVideos() {
      if (!program || !token) {
        setProtectedVideoUrls({});
        return;
      }

      const exercises = (
        program.days || []
      ).flatMap((day) =>
        Array.isArray(day?.exercises)
          ? day.exercises
          : []
      );

      const mediaExercises =
        exercises.filter(
          (exercise) =>
            exercise?.video_media_url
        );

      if (!mediaExercises.length) {
        setProtectedVideoUrls({});
        return;
      }

      const entries =
        await Promise.all(
          mediaExercises.map(
            async (exercise) => {
              const exerciseId =
                getExerciseId(
                  exercise
                );

              if (exerciseId == null) {
                return null;
              }

              try {
                const endpoint =
                  String(
                    exercise.video_media_url
                  ).trim();

                if (!endpoint) {
                  return null;
                }

                const response =
                  await fetch(
                    endpoint,
                    {
                      method: "GET",
                      headers: {
                        Authorization:
                          `Bearer ${token}`,
                      },
                    }
                  );

                const contentType =
                  response.headers.get(
                    "content-type"
                  ) || "";

                if (
                  contentType.includes(
                    "application/json"
                  )
                ) {
                  const data =
                    await response
                      .json()
                      .catch(
                        () => ({})
                      );

                  if (
                    response.ok &&
                    data.success &&
                    data.url
                  ) {
                    return [
                      String(
                        exerciseId
                      ),
                      data.url,
                    ];
                  }

                  return null;
                }

                if (
                  response.ok &&
                  contentType.startsWith(
                    "video/"
                  )
                ) {
                  const blob =
                    await response.blob();

                  if (!blob.size) {
                    return null;
                  }

                  const blobUrl =
                    URL.createObjectURL(
                      blob
                    );

                  return [
                    String(
                      exerciseId
                    ),
                    blobUrl,
                  ];
                }

                return null;
              } catch {
                return null;
              }
            }
          )
        );

      if (cancelled) {
        entries
          .filter(Boolean)
          .forEach(
            ([, url]) => {
              if (
                typeof url ===
                  "string" &&
                url.startsWith(
                  "blob:"
                )
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

        return;
      }

      setProtectedVideoUrls(
        Object.fromEntries(
          entries.filter(Boolean)
        )
      );
    }

    loadProtectedVideos();

    return () => {
      cancelled = true;
    };
  }, [program, token]);

  /*
  ==================================================
  تنظيف روابط Blob عند مغادرة الصفحة
  ==================================================
  */

  useEffect(() => {
    return () => {
      setProtectedVideoUrls(
        (current) => {
          Object.values(current).forEach(
            (url) => {
              if (
                typeof url ===
                  "string" &&
                url.startsWith(
                  "blob:"
                )
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

          return {};
        }
      );
    };
  }, []);

  /*
  ==================================================
  الأسابيع المستخدمة في حالة الفتح والإغلاق
  ==================================================
  */

  function weeksForOpenState(
    sourceProgram
  ) {
    if (!sourceProgram) {
      return [];
    }

    if (
      Array.isArray(
        sourceProgram.weeks
      )
    ) {
      return sourceProgram.weeks.flatMap(
        (week) =>
          Array.isArray(
            week?.days
          )
            ? week.days
            : []
      );
    }

    return [];
  }

  function toggleDay(dayId) {
    const key = String(dayId);

    setOpenDays(
      (current) => ({
        ...current,
        [key]: !current[key],
      })
    );
  }

  /*
  ==================================================
  HELPERS
  ==================================================
  */

  function normalizeStatus(value) {
    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function getSubscriptionStatusValue(
    item
  ) {
    if (!item) {
      return "";
    }

    return (
      item.status ||
      item.subscriptionStatus ||
      item.subscription_status ||
      item.state ||
      ""
    );
  }

  function getSubscriptionPackageName(
    item
  ) {
    if (!item) {
      return "الباقة الحالية";
    }

    return (
      item.package_name ||
      item.packageName ||
      item.package?.name ||
      item.plan_name ||
      item.planName ||
      item.plan?.name ||
      item.package?.title ||
      item.plan?.title ||
      "الباقة الحالية"
    );
  }

  function getExerciseId(
    exercise
  ) {
    return (
      exercise?._id ||
      exercise?.id ||
      exercise?.exerciseId ||
      exercise?.exercise_id
    );
  }

  /*
  ==================================================
  API HEADERS
  ==================================================
  */

  const authHeaders = useMemo(
    () => ({
      Authorization:
        `Bearer ${token}`,

      "Content-Type":
        "application/json",
    }),
    [token]
  );

  /*
  ==================================================
  LOAD SUBSCRIPTION
  ==================================================
  */

  async function loadSubscription() {
    try {
      setSubscriptionLoading(
        true
      );

      if (!token) {
        setSubscription(null);
        return;
      }

      const response =
        await fetch(
          `${API_URL}/subscriptions/my`,
          {
            method: "GET",
            headers:
              authHeaders,
          }
        );

      let data = null;

      try {
        data =
          await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setSubscription(null);
        return;
      }

      const receivedSubscription =
        data?.subscription ||
        data?.data?.subscription ||
        data?.data ||
        (
          data &&
          typeof data ===
            "object" &&
          (
            data.status ||
            data.subscriptionStatus ||
            data.subscription_status ||
            data.package_name ||
            data.packageName
          )
            ? data
            : null
        );

      if (
        !receivedSubscription
      ) {
        setSubscription(null);
        return;
      }

      setSubscription(
        receivedSubscription
      );
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoading(
        false
      );
    }
  }

  /*
  ==================================================
  SUBSCRIPTION ACTIVE
  ==================================================
  */

  const isSubscriptionActive =
    useMemo(() => {
      if (!subscription) {
        return false;
      }

      const rawStatus =
        getSubscriptionStatusValue(
          subscription
        );

      const status =
        normalizeStatus(
          rawStatus
        );

      const activeStatuses = [
        "active",
        "activated",
        "active_subscription",
        "active-subscription",
      ];

      if (
        !activeStatuses.includes(
          status
        )
      ) {
        return false;
      }

      const endDate =
        subscription.end_date ||
        subscription.endDate ||
        subscription.expiresAt ||
        subscription.expires_at ||
        subscription.expiryDate ||
        subscription.expiry_date ||
        subscription.subscription_end ||
        subscription.subscriptionEnd ||
        null;

      if (!endDate) {
        return true;
      }

      const parsedEndDate =
        new Date(endDate);

      if (
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        return true;
      }

      return (
        parsedEndDate.getTime() >
        Date.now()
      );
    }, [subscription]);

  /*
  ==================================================
  LOAD PROGRAM
  ==================================================
  */

  async function loadProgram() {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        setProgram(null);

        setError(
          "يجب تسجيل الدخول أولًا"
        );

        return;
      }

      const response =
        await fetch(
          `${API_URL}/training/my-program`,
          {
            method: "GET",
            headers:
              authHeaders,
          }
        );

      let data = null;

      try {
        data =
          await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(
          data?.message ||
            data?.error ||
            "حدث خطأ أثناء جلب البرنامج"
        );

        return;
      }

      const receivedProgram =
        data?.program ||
        data?.trainingProgram ||
        data?.data?.program ||
        data?.data ||
        null;

      setProgram(
        receivedProgram
      );

      if (
        data?.progress &&
        typeof data.progress ===
          "object"
      ) {
        setProgress(
          normalizeProgress(
            data.progress
          )
        );
      }
    } catch {
      setError(
        "تعذر الاتصال بالسيرفر"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  ==================================================
  NORMALIZE PROGRESS
  ==================================================
  */

  function normalizeProgress(
    source
  ) {
    const progressMap = {};

    if (!source) {
      return progressMap;
    }

    if (
      Array.isArray(source)
    ) {
      source.forEach(
        (item) => {
          const id =
            item?.exercise_id ||
            item?.exerciseId ||
            item?.exercise?._id ||
            item?.exercise?.id ||
            item?._id ||
            item?.id;

          if (id != null) {
            progressMap[
              String(id)
            ] = Boolean(
              item?.completed
            );
          }
        }
      );

      return progressMap;
    }

    if (
      typeof source ===
      "object"
    ) {
      Object.keys(
        source
      ).forEach(
        (key) => {
          const value =
            source[key];

          if (
            typeof value ===
            "boolean"
          ) {
            progressMap[
              String(key)
            ] = value;

            return;
          }

          if (
            value &&
            typeof value ===
              "object"
          ) {
            progressMap[
              String(key)
            ] = Boolean(
              value.completed
            );
          }
        }
      );
    }

    return progressMap;
  }

  /*
  ==================================================
  LOAD PROGRESS
  ==================================================
  */

  async function loadProgress() {
    try {
      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_URL}/progress`,
          {
            method: "GET",
            headers:
              authHeaders,
          }
        );

      let data = null;

      try {
        data =
          await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        return;
      }

      const receivedProgress =
        data?.progress ||
        data?.data?.progress ||
        data?.data ||
        {};

      setProgress(
        normalizeProgress(
          receivedProgress
        )
      );
    } catch {
      // ignore progress loading errors
    }
  }

  /*
  ==================================================
  LOAD ALL DATA
  ==================================================
  */

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!mounted) {
        return;
      }

      await loadSubscription();

      if (!mounted) {
        return;
      }

      await Promise.all([
        loadProgram(),
        loadProgress(),
      ]);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [token]);

  /*
  ==================================================
  WEEKS
  ==================================================
  */

  const weeks = useMemo(() => {
    if (!program) {
      return [];
    }

    if (
      Array.isArray(
        program.weeks
      )
    ) {
      return program.weeks.map(
        (
          week,
          index
        ) => ({
          weekNumber:
            Number(
              week.weekNumber ||
                week.week_number ||
                week.number ||
                index + 1
            ) || index + 1,

          days:
            Array.isArray(
              week.days
            )
              ? week.days
              : [],
        })
      );
    }

    if (
      !Array.isArray(
        program.days
      )
    ) {
      return [];
    }

    const grouped = {};

    program.days.forEach(
      (
        day,
        index
      ) => {
        const weekNumber =
          Number(
            day?.week_number ??
              day?.weekNumber ??
              (
                day?.weekIndex !=
                null
                  ? day.weekIndex + 1
                  : 1
              )
          ) || 1;

        if (
          !grouped[
            weekNumber
          ]
        ) {
          grouped[
            weekNumber
          ] = [];
        }

        grouped[
          weekNumber
        ].push({
          ...day,

          weekNumber,

          week_number:
            day?.week_number ??
            weekNumber,

          day_number:
            day?.day_number ??
            day?.dayNumber ??
            index + 1,
        });
      }
    );

    return Object.keys(
      grouped
    )
      .map(Number)
      .sort(
        (a, b) =>
          a - b
      )
      .map(
        (weekNumber) => ({
          weekNumber,

          days:
            grouped[
              weekNumber
            ]
              .slice()
              .sort(
                (a, b) =>
                  Number(
                    a.day_number
                  ) -
                  Number(
                    b.day_number
                  )
              ),
        })
      );
  }, [program]);

  /*
  ==================================================
  ALL DAYS
  ==================================================
  */

  const allDays = useMemo(
    () => {
      if (!program) {
        return [];
      }

      if (
        Array.isArray(
          program.days
        )
      ) {
        return program.days;
      }

      return weeks.flatMap(
        (week) =>
          Array.isArray(
            week.days
          )
            ? week.days
            : []
      );
    },
    [
      program,
      weeks,
    ]
  );

  /*
  ==================================================
  ALL EXERCISES
  ==================================================
  */

  const allExercises =
    useMemo(
      () => {
        return allDays.flatMap(
          (day) =>
            Array.isArray(
              day?.exercises
            )
              ? day.exercises
              : Array.isArray(
                  day?.workoutExercises
                )
              ? day.workoutExercises
              : []
        );
      },
      [allDays]
    );

  const totalExercises =
    allExercises.length;

  const completedCount =
    allExercises.filter(
      (exercise) => {
        const id =
          getExerciseId(
            exercise
          );

        return (
          id != null &&
          Boolean(
            progress[
              String(id)
            ]
          )
        );
      }
    ).length;

  const programPercentage =
    totalExercises > 0
      ? Math.round(
          (
            completedCount /
            totalExercises
          ) * 100
        )
      : 0;

  const totalDays =
    allDays.length;

  const completedDays =
    allDays.filter(
      (day) => {
        const exercises =
          Array.isArray(
            day?.exercises
          )
            ? day.exercises
            : [];

        if (
          exercises.length ===
          0
        ) {
          return false;
        }

        return exercises.every(
          (exercise) => {
            const id =
              getExerciseId(
                exercise
              );

            return (
              id != null &&
              Boolean(
                progress[
                  String(id)
                ]
              )
            );
          }
        );
      }
    ).length;

  /*
  ==================================================
  TOGGLE EXERCISE
  ==================================================
  */

  async function toggleExercise(
    exerciseId
  ) {
    if (!token) {
      alert(
        "يجب تسجيل الدخول أولًا"
      );

      navigate(
        "/login"
      );

      return;
    }

    if (!exerciseId) {
      alert(
        "تعذر تحديد التمرين."
      );

      return;
    }

    if (
      !isSubscriptionActive
    ) {
      alert(
        "لا يمكنك تسجيل التمرين لأن اشتراكك غير فعال."
      );

      return;
    }

    const id =
      String(
        exerciseId
      );

    if (
      savingExercise ===
      id
    ) {
      return;
    }

    const currentStatus =
      Boolean(
        progress[id]
      );

    const newStatus =
      !currentStatus;

    try {
      setSavingExercise(
        id
      );

      const response =
        await fetch(
          `${API_URL}/progress/${encodeURIComponent(
            id
          )}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                completed:
                  newStatus,
              }),
          }
        );

      let data =
        null;

      try {
        data =
          await response.json();
      } catch {
        data =
          null;
      }

      if (!response.ok) {
        alert(
          data?.message ||
            data?.error ||
            "تعذر حفظ حالة التمرين، حاول مرة أخرى."
        );

        return;
      }

      setProgress(
        (previous) => ({
          ...previous,

          [id]:
            newStatus,
        })
      );

      if (
        data?.progress
      ) {
        const serverProgress =
          normalizeProgress(
            data.progress
          );

        if (
          Object.keys(
            serverProgress
          ).length > 0
        ) {
          setProgress(
            serverProgress
          );
        }
      }
    } catch {
      alert(
        "تعذر الاتصال بالسيرفر، حاول مرة أخرى."
      );
    } finally {
      setSavingExercise(
        null
      );
    }
  }

  /*
  ==================================================
  LOGOUT
  ==================================================
  */

  function logout() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "client"
    );

    navigate(
      "/login"
    );
  }

  /*
  ==================================================
  RETRY
  ==================================================
  */

  async function retry() {
    setError("");

    await loadSubscription();

    await Promise.all([
      loadProgram(),
      loadProgress(),
    ]);
  }

  /*
  ==================================================
  PACKAGES
  ==================================================
  */

  function goToPackages() {
    navigate(
      "/client/packages"
    );
  }

  /*
  ==================================================
  LOADING
  ==================================================
  */

  if (
    loading ||
    subscriptionLoading
  ) {
    return (
      <div
        className="client-training-page luxury-client-page"
        dir="rtl"
      >
        <div className="client-training-loading luxury-loading-card">
          <div className="luxury-loading-icon">
            ✦
          </div>

          <div className="luxury-spinner" />

          <h2>
            جاري تجهيز برنامجك
          </h2>

          <p>
            لحظات ونتحقق من اشتراكك وبرنامجك...
          </p>
        </div>
      </div>
    );
  }

  /*
  ==================================================
  ERROR
  ==================================================
  */

  if (error) {
    return (
      <div
        className="client-training-page luxury-client-page"
        dir="rtl"
      >
        <div className="client-training-error luxury-error-card">
          <div className="luxury-status-icon">
            !
          </div>

          <h2>
            حدث خطأ
          </h2>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={
              retry
            }
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  /*
  ==================================================
  SUBSCRIPTION NOT ACTIVE
  ==================================================
  */

  if (
    !isSubscriptionActive
  ) {
    return (
      <div
        className="client-training-page luxury-client-page"
        dir="rtl"
      >
        <header className="client-header luxury-client-header">
          <div className="client-header-brand">
            <div className="luxury-brand-mark">
              JC
            </div>

            <div>
              <span className="luxury-eyebrow">
                COACHING EXPERIENCE
              </span>

              <h1>
                مرحبًا{" "}
                {userName}{" "}
                <span className="welcome-emoji">
                  👋
                </span>
              </h1>

              <p>
                رحلتك التدريبية تبدأ من هنا
              </p>
            </div>
          </div>

          <div className="client-header-actions">
            <button
              type="button"
              className="header-packages-button"
              onClick={
                goToPackages
              }
            >
              <span>
                💎
              </span>

              الباقات والاشتراك
            </button>

            <button
              type="button"
              className="logout-button luxury-logout-button"
              onClick={
                logout
              }
            >
              تسجيل الخروج
            </button>
          </div>
        </header>

        <main className="client-training-content">
          <div className="client-training-empty luxury-empty-state">
            <div className="luxury-brand-mark">
              JC
            </div>

            <h1>
              أهلًا{" "}
              <span>
                {userName}
              </span>{" "}
              👋
            </h1>

            <p className="luxury-empty-subtitle">
              مساحة التدريب الخاصة بك جاهزة لك
            </p>

            <div className="empty-card luxury-empty-card">
              <div className="empty-icon">
                🏋️
              </div>

              <div className="luxury-gold-line" />

              <h2>
                التدريب متاح مع الاشتراك الفعال
              </h2>

              <p>
                يجب أن يكون لديك اشتراك فعال
                للوصول إلى برنامجك التدريبي
                وتسجيل إنجاز التمارين.
              </p>

              {normalizeStatus(
                getSubscriptionStatusValue(
                  subscription
                )
              ) ===
                "pending" && (
                <p>
                  طلب اشتراكك قيد المراجعة من
                  المدرب. سيتم فتح البرنامج بعد
                  الموافقة.
                </p>
              )}

              {normalizeStatus(
                getSubscriptionStatusValue(
                  subscription
                )
              ) ===
                "rejected" && (
                <p>
                  يمكنك اختيار باقة أخرى
                  وإرسال طلب اشتراك جديد.
                </p>
              )}

              {normalizeStatus(
                getSubscriptionStatusValue(
                  subscription
                )
              ) ===
                "expired" && (
                <p>
                  انتهت مدة اشتراكك. اختر باقة
                  جديدة للاستمرار في التدريب.
                </p>
              )}

              {normalizeStatus(
                getSubscriptionStatusValue(
                  subscription
                )
              ) ===
                "paused" && (
                <p>
                  اشتراكك موقوف حاليًا. تواصل
                  مع المدرب أو اختر الباقة
                  المناسبة عند توفرها.
                </p>
              )}

              {!subscription && (
                <p>
                  لم تقم بالاشتراك في أي باقة
                  حتى الآن.
                </p>
              )}

              <button
                type="button"
                onClick={
                  goToPackages
                }
              >
                💎 عرض الباقات والاشتراك
              </button>
            </div>
          </div>
        </main>

        <footer className="luxury-client-footer">
          <span>
            GYM COACH
          </span>

          <b>
            •
          </b>

          <span>
            TRAIN SMART · STAY STRONG
          </span>
        </footer>
      </div>
    );
  }

  /*
  ==================================================
  ACTIVE SUBSCRIPTION / NO PROGRAM
  ==================================================
  */

  if (!program) {
    return (
      <div
        className="client-training-page luxury-client-page"
        dir="rtl"
      >
        <header className="client-header luxury-client-header">
          <div className="client-header-brand">
            <div className="luxury-brand-mark">
              JC
            </div>

            <div>
              <span className="luxury-eyebrow">
                COACHING EXPERIENCE
              </span>

              <h1>
                مرحبًا{" "}
                {userName}{" "}
                <span className="welcome-emoji">
                  👋
                </span>
              </h1>

              <p>
                رحلتك التدريبية تبدأ من هنا
              </p>
            </div>
          </div>

          <div className="client-header-actions">
            <button
              type="button"
              className="logout-button luxury-logout-button"
              onClick={
                logout
              }
            >
              تسجيل الخروج
            </button>
          </div>
        </header>

        <main className="client-training-content">
          <div className="client-training-empty luxury-empty-state">
            <div className="luxury-brand-mark">
              JC
            </div>

            <h1>
              أهلًا{" "}
              <span>
                {userName}
              </span>{" "}
              👋
            </h1>

            <p className="luxury-empty-subtitle">
              اشتراكك فعال، ونحن بانتظار إضافة برنامجك
            </p>

            <div className="empty-card luxury-empty-card">
              <div className="empty-icon">
                🏋️
              </div>

              <div className="luxury-gold-line" />

              <h2>
                لا يوجد برنامج تدريبي حاليًا
              </h2>

              <p>
                اشتراكك فعال، ولكن لم يقم المدرب
                بإضافة برنامج تدريبي لك حتى الآن.
              </p>

              <p>
                سيظهر برنامجك هنا بمجرد أن يقوم
                المدرب بتخصيصه لك.
              </p>

              <button
                type="button"
                onClick={
                  retry
                }
              >
                إعادة تحميل البرنامج
              </button>
            </div>
          </div>
        </main>

        <footer className="luxury-client-footer">
          <span>
            GYM COACH
          </span>

          <b>
            •
          </b>

          <span>
            TRAIN SMART · STAY STRONG
          </span>
        </footer>
      </div>
    );
  }

  /*
  ==================================================
  TRAINING PROGRAM
  ==================================================
  */

  return (
    <div
      className="client-training-page luxury-client-page"
      dir="rtl"
    >
      <header className="client-header luxury-client-header">
        <div className="client-header-brand">
          <div className="luxury-brand-mark">
            JC
          </div>

          <div>
            <span className="luxury-eyebrow">
              COACHING EXPERIENCE
            </span>

            <h1>
              مرحبًا{" "}
              {userName}{" "}
              <span className="welcome-emoji">
                👋
              </span>
            </h1>

            <p>
              رحلتك التدريبية تبدأ من هنا
            </p>
          </div>
        </div>

        <div className="client-header-actions">
          <button
            type="button"
            className="logout-button luxury-logout-button"
            onClick={
              logout
            }
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      <section className="program-info-card luxury-program-hero">
        <div className="luxury-hero-glow" />

        <div className="program-hero-top">
          <div>
            <span className="luxury-section-label">
              PROGRAM
            </span>

            <h2>
              {program.name ||
                program.title ||
                program.programName ||
                "برنامجك التدريبي"}
            </h2>

            {(
              program.description ||
              program.notes
            ) && (
              <p className="program-description">
                {program.description ||
                  program.notes}
              </p>
            )}
          </div>

          <div className="program-status-badge">
            <span className="status-dot" />

            البرنامج نشط
          </div>
        </div>

        <div className="program-meta luxury-program-meta">
          <span>
            <b>
              👤
            </b>

            {program.client_name ||
              program.clientName ||
              userName}
          </span>

          <span>
            <b>
              🏋️
            </b>

            {totalExercises} تمرين إجمالي
          </span>

          <span>
            <b>
              📅
            </b>

            {totalDays} أيام تدريب
          </span>

          <span>
            <b>
              ✓
            </b>

            {completedDays} أيام مكتملة
          </span>
        </div>

        <div className="program-progress luxury-program-progress">
          <div className="progress-header">
            <div>
              <span>
                التقدم العام
              </span>

              <strong>
                {completedCount} /{" "}
                {totalExercises} تمرين
              </strong>
            </div>

            <strong className="progress-percentage">
              {programPercentage}%
            </strong>
          </div>

          <div
            className="progress-bar luxury-progress-bar"
            aria-label={`نسبة الإنجاز ${programPercentage}%`}
          >
            <div
              className="progress-bar-fill luxury-progress-fill"
              style={{
                width:
                  `${programPercentage}%`,
              }}
            />
          </div>

          <div className="progress-footer">
            <span>
              {programPercentage ===
              100
                ? "ممتاز! أكملت البرنامج بالكامل 🏆"
                : "استمر، كل تمرين يقربك من هدفك ✦"}
            </span>

            <span>
              {completedCount} من{" "}
              {totalExercises}
            </span>
          </div>
        </div>
      </section>

      <main className="client-training-content">
        <div className="luxury-content-heading">
          <div>
            <span className="luxury-section-label">
              YOUR WORKOUT
            </span>

            <h2>
              جدولك التدريبي
            </h2>

            <p>
              تابع أيامك وتمارينك وسجل إنجازك.
            </p>
          </div>

          <div className="luxury-total-badge">
            {totalExercises} تمرين
          </div>
        </div>

        {weeks.length ===
        0 ? (
          <div className="no-days luxury-empty-workout">
            <span>
              ✦
            </span>

            <h3>
              لم تتم إضافة أيام تدريب حتى الآن.
            </h3>

            <p>
              سيظهر جدولك هنا بمجرد أن يقوم المدرب بإضافته.
            </p>
          </div>
        ) : (
          <div className="client-weeks-list">
            {weeks.map(
              (
                {
                  weekNumber,
                  days,
                },
                weekIndex
              ) => {
                const dayOffset =
                  weeks
                    .slice(
                      0,
                      weekIndex
                    )
                    .reduce(
                      (
                        total,
                        item
                      ) =>
                        total +
                        item.days
                          .length,
                      0
                    );

                const weekExercises =
                  days.flatMap(
                    (day) =>
                      Array.isArray(
                        day?.exercises
                      )
                        ? day.exercises
                        : []
                  );

                const weekTotalExercises =
                  weekExercises.length;

                const weekCompletedExercises =
                  weekExercises.filter(
                    (exercise) => {
                      const id =
                        getExerciseId(
                          exercise
                        );

                      return (
                        id != null &&
                        Boolean(
                          progress[
                            String(
                              id
                            )
                          ]
                        )
                      );
                    }
                  ).length;

                const weekPercentage =
                  weekTotalExercises >
                  0
                    ? Math.round(
                        (
                          weekCompletedExercises /
                          weekTotalExercises
                        ) *
                          100
                      )
                    : 0;

                const weekComplete =
                  weekTotalExercises >
                    0 &&
                  weekCompletedExercises ===
                    weekTotalExercises;

                return (
                  <section
                    className={
                      weekComplete
                        ? "client-week-card luxury-week-card week-completed"
                        : "client-week-card luxury-week-card"
                    }
                    key={`week-${weekNumber}`}
                  >
                    <div className="client-week-days">
                      {days.map(
                        (
                          day,
                          dayIndex
                        ) => {
                          const dayExercises =
                            Array.isArray(
                              day?.exercises
                            )
                              ? day.exercises
                              : [];

                          const dayCompleted =
                            dayExercises.filter(
                              (
                                exercise
                              ) => {
                                const id =
                                  getExerciseId(
                                    exercise
                                  );

                                return (
                                  id !=
                                    null &&
                                  Boolean(
                                    progress[
                                      String(
                                        id
                                      )
                                    ]
                                  )
                                );
                              }
                            ).length;

                          const dayTotal =
                            dayExercises.length;

                          const dayPercentage =
                            dayTotal >
                            0
                              ? Math.round(
                                  (
                                    dayCompleted /
                                    dayTotal
                                  ) *
                                    100
                                )
                              : 0;

                          const dayComplete =
                            dayTotal >
                              0 &&
                            dayCompleted ===
                              dayTotal;

                          const dayId =
                            day?._id ||
                            day?.id ||
                            `day-${weekNumber}-${dayIndex}`;

                          const dayKey =
                            String(
                              dayId
                            );

                          const isOpen =
                            Boolean(
                              openDays[
                                dayKey
                              ]
                            );

                          return (
                            <section
                              className={
                                dayComplete
                                  ? "client-day-card luxury-day-card day-completed"
                                  : "client-day-card luxury-day-card"
                              }
                              key={
                                dayId
                              }
                            >
                              <div className="client-day-header luxury-day-header">
                                <div className="day-title-group">
                                  <div className="day-number luxury-day-number">
                                    اليوم{" "}
                                    {dayOffset +
                                      dayIndex +
                                      1}
                                  </div>

                                  <div>
                                    <span className="luxury-day-caption">
                                      TRAINING DAY
                                    </span>

                                    <h2>
                                      {day?.name ||
                                        day?.title ||
                                        day?.dayName ||
                                        `اليوم ${
                                          dayIndex +
                                          1
                                        }`}
                                    </h2>
                                  </div>
                                </div>

                                <div
                                  className={
                                    dayComplete
                                      ? "day-progress luxury-day-progress complete"
                                      : "day-progress luxury-day-progress"
                                  }
                                >
                                  <strong>
                                    {
                                      dayCompleted
                                    }
                                    /
                                    {
                                      dayTotal
                                    }
                                  </strong>

                                  <span>
                                    تمرين
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className="day-toggle-button"
                                  onClick={() =>
                                    toggleDay(
                                      dayId
                                    )
                                  }
                                  aria-expanded={
                                    isOpen
                                  }
                                >
                                  <span>
                                    {isOpen
                                      ? "إخفاء التمارين"
                                      : "عرض التمارين"}
                                  </span>

                                  <span className="day-toggle-chevron">
                                    {isOpen
                                      ? "⌃"
                                      : "⌄"}
                                  </span>
                                </button>
                              </div>

                              {isOpen && (
                                <div className="client-day-body">
                                  <div className="day-progress-container luxury-day-progress-container">
                                    <div className="progress-bar luxury-progress-bar">
                                      <div
                                        className="progress-bar-fill luxury-progress-fill"
                                        style={{
                                          width:
                                            `${dayPercentage}%`,
                                        }}
                                      />
                                    </div>

                                    <span className="day-progress-percentage">
                                      {
                                        dayPercentage
                                      }
                                      %
                                    </span>
                                  </div>

                                  {dayExercises.length >
                                  0 ? (
                                    <div className="client-exercises luxury-client-exercises">
                                      {dayExercises.map(
                                        (
                                          exercise,
                                          index
                                        ) => {
                                          const exerciseId =
                                            getExerciseId(
                                              exercise
                                            );

                                          const completed =
                                            exerciseId !=
                                              null &&
                                            Boolean(
                                              progress[
                                                String(
                                                  exerciseId
                                                )
                                              ]
                                            );

                                          const saving =
                                            savingExercise ===
                                            String(
                                              exerciseId
                                            );

                                          const video =
                                            protectedVideoUrls[
                                              String(
                                                exerciseId
                                              )
                                            ] ||
                                            "";

                                          return (
                                            <article
                                              className={
                                                completed
                                                  ? "client-exercise-card luxury-exercise-card completed"
                                                  : "client-exercise-card luxury-exercise-card"
                                              }
                                              key={
                                                exerciseId ||
                                                `exercise-${weekNumber}-${dayIndex}-${index}`
                                              }
                                            >
                                              <div className="exercise-top-row">
                                                <div
                                                  className={
                                                    completed
                                                      ? "exercise-number luxury-exercise-number completed"
                                                      : "exercise-number luxury-exercise-number"
                                                  }
                                                >
                                                  {completed
                                                    ? "✓"
                                                    : index +
                                                      1}
                                                </div>

                                                {completed && (
                                                  <span className="exercise-completed-badge">
                                                    مكتمل ✓
                                                  </span>
                                                )}
                                              </div>

                                              <div className="exercise-content">
                                                <div className="exercise-title-area">
                                                  <span className="luxury-exercise-label">
                                                    EXERCISE{" "}
                                                    {
                                                      index +
                                                      1
                                                    }
                                                  </span>

                                                  <h3>
                                                    {exercise?.name ||
                                                      exercise?.title ||
                                                      exercise?.exerciseName ||
                                                      "تمرين"}
                                                  </h3>
                                                </div>

                                                {(
                                                  exercise?.description ||
                                                  exercise?.instructions ||
                                                  exercise?.note
                                                ) && (
                                                  <p className="exercise-description">
                                                    {exercise?.description ||
                                                      exercise?.instructions ||
                                                      exercise?.note}
                                                  </p>
                                                )}

                                                <div className="exercise-details luxury-exercise-details">
                                                  {(
                                                    exercise?.sets ??
                                                    exercise?.setCount ??
                                                    exercise?.numberOfSets
                                                  ) !=
                                                    null && (
                                                    <div className="detail-box luxury-detail-box">
                                                      <span>
                                                        المجموعات
                                                      </span>

                                                      <strong>
                                                        {
                                                          exercise?.sets ??
                                                          exercise?.setCount ??
                                                          exercise?.numberOfSets
                                                        }
                                                      </strong>
                                                    </div>
                                                  )}

                                                  {(
                                                    exercise?.reps ??
                                                    exercise?.repetitions ??
                                                    exercise?.repetition
                                                  ) !=
                                                    null && (
                                                    <div className="detail-box luxury-detail-box">
                                                      <span>
                                                        التكرارات
                                                      </span>

                                                      <strong>
                                                        {
                                                          exercise?.reps ??
                                                          exercise?.repetitions ??
                                                          exercise?.repetition
                                                        }
                                                      </strong>
                                                    </div>
                                                  )}

                                                  {(
                                                    exercise?.rest_seconds ??
                                                    exercise?.restSeconds ??
                                                    exercise?.rest ??
                                                    exercise?.restTime
                                                  ) !=
                                                    null && (
                                                    <div className="detail-box luxury-detail-box">
                                                      <span>
                                                        الراحة
                                                      </span>

                                                      <strong>
                                                        {
                                                          exercise?.rest_seconds ??
                                                          exercise?.restSeconds ??
                                                          exercise?.rest ??
                                                          exercise?.restTime
                                                        }

                                                        {typeof (
                                                          exercise?.rest_seconds ??
                                                          exercise?.restSeconds
                                                        ) ===
                                                        "number"
                                                          ? " ثانية"
                                                          : ""}
                                                      </strong>
                                                    </div>
                                                  )}

                                                  {(
                                                    exercise?.weight ??
                                                    exercise?.load ??
                                                    exercise?.recommendedWeight
                                                  ) !=
                                                    null && (
                                                    <div className="detail-box luxury-detail-box">
                                                      <span>
                                                        الوزن
                                                      </span>

                                                      <strong>
                                                        {
                                                          exercise?.weight ??
                                                          exercise?.load ??
                                                          exercise?.recommendedWeight
                                                        }
                                                      </strong>
                                                    </div>
                                                  )}
                                                </div>

                                                {video && (
                                                  <div className="client-video-section luxury-video-section">
                                                    <div className="video-heading">
                                                      <div className="video-icon">
                                                        ▶
                                                      </div>

                                                      <div>
                                                        <span>
                                                          VIDEO GUIDE
                                                        </span>

                                                        <h4>
                                                          شرح التمرين
                                                        </h4>
                                                      </div>
                                                    </div>

                                                    <div className="video-frame">
                                                      <video
                                                        controls
                                                        preload="metadata"
                                                        playsInline
                                                        className="client-exercise-video"
                                                        src={
                                                          video
                                                        }
                                                        onError={() => {
                                                          /*
                                                          لا نعيد تحميل الفيديو تلقائيًا
                                                          حتى لا يدخل المتصفح في loop.
                                                          */
                                                        }}
                                                      >
                                                        متصفحك لا يدعم تشغيل الفيديو.
                                                      </video>
                                                    </div>
                                                  </div>
                                                )}

                                                <button
                                                  type="button"
                                                  className={
                                                    completed
                                                      ? "exercise-complete-button luxury-complete-button completed"
                                                      : "exercise-complete-button luxury-complete-button"
                                                  }
                                                  disabled={
                                                    saving ||
                                                    !isSubscriptionActive ||
                                                    !exerciseId
                                                  }
                                                  onClick={() =>
                                                    toggleExercise(
                                                      exerciseId
                                                    )
                                                  }
                                                >
                                                  <span className="complete-button-icon">
                                                    {saving
                                                      ? "..."
                                                      : completed
                                                      ? "✓"
                                                      : "○"}
                                                  </span>

                                                  <span>
                                                    {saving
                                                      ? "جاري حفظ التقدم..."
                                                      : completed
                                                      ? "تم إنجاز التمرين"
                                                      : "تحديد التمرين كمكتمل"}
                                                  </span>
                                                </button>
                                              </div>
                                            </article>
                                          );
                                        }
                                      )}
                                    </div>
                                  ) : (
                                    <div className="no-exercises luxury-empty-workout">
                                      <span>
                                        ✦
                                      </span>

                                      <p>
                                        لا توجد تمارين مضافة لهذا اليوم.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        }
                      )}
                    </div>
                  </section>
                );
              }
            )}
          </div>
        )}
      </main>

      <footer className="luxury-client-footer">
        <span>
          GYM COACH
        </span>

        <b>
          •
        </b>

        <span>
          TRAIN SMART · STAY STRONG
        </span>
      </footer>
    </div>
  );
}

/*
==================================================
الحالات النشطة للاشتراك
==================================================
*/

const activeSubscriptionStatuses = [
  "active",
  "activated",
  "active_subscription",
  "active-subscription",
];

/*
==================================================
نهاية الملف
==================================================
*/

export default ClientTraining;