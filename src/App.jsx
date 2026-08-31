import API_URL from "./config/api";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";

import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Packages from "./pages/Packages";
import Clients from "./pages/Clients";
import Transformations from "./pages/Transformations";

import ClientTraining from "./pages/ClientTraining";
import ClientNutrition from "./pages/ClientNutrition";
import ClientPackages from "./pages/ClientPackages";

import SubscriptionRequests from "./pages/SubscriptionRequests";

import ProtectedRoute from "./components/ProtectedRoute";
import ClientLayout from "./components/ClientLayout";
import AdminLayout from "./components/AdminLayout";

import ClientChat from "./pages/ClientChat";
import AdminChat from "./pages/AdminChat";
import ClientSubscriptions from "./pages/ClientSubscriptions";

/*
=========================================================
LOCAL STORAGE HELPERS
=========================================================
*/

const getStoredUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") ||
        "{}"
    );
  } catch {
    return {};
  }
};

const getToken = () => {
  return (
    localStorage.getItem("token") ||
    ""
  );
};

/*
=========================================================
SAFE NUMBER
=========================================================
*/

const safeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

/*
=========================================================
ARRAY HELPER
=========================================================
*/

const getArrayFromData = (
  data,
  keys = []
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  for (const key of keys) {
    if (
      Array.isArray(
        data?.[key]
      )
    ) {
      return data[key];
    }
  }

  return [];
};

/*
=========================================================
COMPLETION HELPER
=========================================================
*/

const isCompletedItem = (
  item
) => {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return false;
  }

  if (
    item.completed === true ||
    item.isCompleted === true ||
    item.done === true ||
    item.finished === true
  ) {
    return true;
  }

  const status = String(
    item.status || ""
  ).toLowerCase();

  return [
    "completed",
    "complete",
    "done",
    "finished",
    "مكتمل",
    "مكتملة",
    "تم",
  ].includes(status);
};

/*
=========================================================
PROGRESS VALUE
=========================================================
*/

const getProgressValue = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const value =
    data?.percentage ??
    data?.progressPercentage ??
    data?.completionPercentage ??
    data?.progress?.percentage ??
    data?.progress
      ?.completionPercentage ??
    data?.stats
      ?.completionPercentage ??
    data?.stats?.percentage;

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        safeNumber(value)
      )
    )
  );
};

/*
=========================================================
COMPLETED WORKOUTS
=========================================================
*/

const getCompletedWorkouts = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const value =
    data?.completedWorkouts ??
    data?.completedExercises ??
    data?.completedDays ??
    data?.progress
      ?.completedWorkouts ??
    data?.progress
      ?.completedExercises ??
    data?.progress
      ?.completedDays ??
    data?.stats
      ?.completedWorkouts ??
    data?.stats
      ?.completedExercises ??
    data?.stats?.completedDays;

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return safeNumber(value);
};

/*
=========================================================
TOTAL WORKOUTS
=========================================================
*/

const getTotalWorkouts = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const value =
    data?.totalWorkouts ??
    data?.totalExercises ??
    data?.totalDays ??
    data?.progress?.totalWorkouts ??
    data?.progress?.totalExercises ??
    data?.progress?.totalDays ??
    data?.stats?.totalWorkouts ??
    data?.stats?.totalExercises ??
    data?.stats?.totalDays;

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return safeNumber(value);
};

/*
=========================================================
STREAK
=========================================================
*/

const getStreakValue = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const value =
    data?.streak ??
    data?.currentStreak ??
    data?.daysStreak ??
    data?.progress?.streak ??
    data?.progress?.currentStreak ??
    data?.stats?.streak ??
    data?.stats?.currentStreak;

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return safeNumber(value);
};

/*
=========================================================
TRAINING DAYS
=========================================================
*/

const extractTrainingDays = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const directDays =
    getArrayFromData(
      data,
      [
        "days",
        "trainingDays",
        "workoutDays",
        "programDays",
      ]
    );

  if (directDays.length) {
    return directDays;
  }

  if (
    Array.isArray(
      data?.program?.days
    )
  ) {
    return data.program.days;
  }

  if (
    Array.isArray(
      data?.trainingProgram?.days
    )
  ) {
    return data.trainingProgram
      .days;
  }

  if (
    Array.isArray(
      data?.program?.trainingDays
    )
  ) {
    return data.program.trainingDays;
  }

  return [];
};

/*
=========================================================
EXERCISES
=========================================================
*/

const extractExercises = (
  data
) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const directExercises =
    getArrayFromData(
      data,
      [
        "exercises",
        "workouts",
        "training",
        "sessions",
      ]
    );

  if (directExercises.length) {
    return directExercises;
  }

  const days =
    extractTrainingDays(
      data
    );

  if (!days.length) {
    return [];
  }

  return days.flatMap(
    (day) => {
      if (
        !day ||
        typeof day !==
          "object"
      ) {
        return [];
      }

      return getArrayFromData(
        day,
        [
          "exercises",
          "workouts",
          "training",
          "sessions",
        ]
      );
    }
  );
};

/*
=========================================================
TRAINING STATS
=========================================================
*/

const calculateTrainingStats = (
  trainingData
) => {
  const days =
    extractTrainingDays(
      trainingData
    );

  const exercises =
    extractExercises(
      trainingData
    );

  if (exercises.length) {
    const completedExercises =
      exercises.filter(
        isCompletedItem
      ).length;

    return {
      total:
        exercises.length,

      completed:
        completedExercises,

      percentage:
        exercises.length > 0
          ? Math.min(
              100,
              Math.round(
                (
                  completedExercises /
                  exercises.length
                ) *
                  100
              )
            )
          : 0,

      completedDays:
        days.filter(
          isCompletedItem
        ).length,
    };
  }

  if (days.length) {
    const completedDays =
      days.filter(
        isCompletedItem
      ).length;

    return {
      total:
        days.length,

      completed:
        completedDays,

      percentage:
        days.length > 0
          ? Math.min(
              100,
              Math.round(
                (
                  completedDays /
                  days.length
                ) *
                  100
              )
            )
          : 0,

      completedDays,
    };
  }

  return {
    total: 0,
    completed: 0,
    percentage: 0,
    completedDays: 0,
  };
};

/*
=========================================================
CLIENT HOME
=========================================================
*/

function ClientHome() {
  const [user, setUser] =
    useState(
      getStoredUser()
    );

  const [
    dashboardData,
    setDashboardData,
  ] = useState(null);

  const [
    progressData,
    setProgressData,
  ] = useState(null);

  const [
    trainingData,
    setTrainingData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
  =======================================================
  LOAD CLIENT DATA
  =======================================================
  */

  useEffect(() => {
    let mounted = true;

    const loadClientData =
      async () => {
        try {
          setLoading(true);
          setError("");

          const token =
            getToken();

          const headers = {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          };

          const [
            dashboardResponse,
            progressResponse,
            trainingResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/subscriptions/my`,
                {
                  method: "GET",
                  headers,
                }
              ),

              fetch(
                `${API_URL}/progress`,
                {
                  method: "GET",
                  headers,
                }
              ),

              fetch(
                `${API_URL}/training/my-program`,
                {
                  method: "GET",
                  headers,
                }
              ),
            ]);

          const dashboardResult =
            await dashboardResponse
              .json()
              .catch(
                () => ({})
              );

          const progressResult =
            await progressResponse
              .json()
              .catch(
                () => ({})
              );

          const trainingResult =
            await trainingResponse
              .json()
              .catch(
                () => ({})
              );

          if (!mounted) {
            return;
          }

          if (
            dashboardResponse.ok
          ) {
            setDashboardData(
              dashboardResult
            );

            if (
              dashboardResult?.user
            ) {
              setUser(
                dashboardResult.user
              );

              localStorage.setItem(
                "user",
                JSON.stringify(
                  dashboardResult.user
                )
              );
            }
          }

          if (
            progressResponse.ok
          ) {
            setProgressData(
              progressResult
            );
          }

          if (
            trainingResponse.ok
          ) {
            setTrainingData(
              trainingResult
            );
          }

          if (
            !dashboardResponse.ok &&
            !progressResponse.ok &&
            !trainingResponse.ok
          ) {
            throw new Error(
              dashboardResult?.message ||
                progressResult?.message ||
                trainingResult?.message ||
                "تعذر تحميل بيانات العميل"
            );
          }
        } catch (err) {
          if (!mounted) {
            return;
          }

          setError(
            err?.message ||
              "حدث خطأ أثناء تحميل بيانات العميل"
          );
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    loadClientData();

    return () => {
      mounted = false;
    };
  }, []);

  /*
  =======================================================
  CLIENT NAME
  =======================================================
  */

  const clientName =
    dashboardData?.user?.name ||
    dashboardData?.client?.name ||
    user?.name ||
    "العميل";

  /*
  =======================================================
  TRAINING STATS
  =======================================================
  */

  const calculatedTrainingStats =
    useMemo(
      () =>
        calculateTrainingStats(
          trainingData
        ),
      [trainingData]
    );

  /*
  =======================================================
  TOTAL
  =======================================================
  */

  const totalWorkouts =
    useMemo(
      () => {
        const apiValue =
          getTotalWorkouts(
            progressData
          ) ??
          getTotalWorkouts(
            trainingData
          ) ??
          getTotalWorkouts(
            dashboardData
          );

        if (
          apiValue !== null
        ) {
          return apiValue;
        }

        return calculatedTrainingStats.total;
      },
      [
        progressData,
        trainingData,
        dashboardData,
        calculatedTrainingStats,
      ]
    );

  /*
  =======================================================
  COMPLETED
  =======================================================
  */

  const completedWorkouts =
    useMemo(
      () => {
        const apiValue =
          getCompletedWorkouts(
            progressData
          ) ??
          getCompletedWorkouts(
            trainingData
          ) ??
          getCompletedWorkouts(
            dashboardData
          );

        if (
          apiValue !== null
        ) {
          return apiValue;
        }

        return calculatedTrainingStats.completed;
      },
      [
        progressData,
        trainingData,
        dashboardData,
        calculatedTrainingStats,
      ]
    );

  /*
  =======================================================
  PERCENTAGE
  =======================================================
  */

  const completionPercentage =
    useMemo(
      () => {
        const apiValue =
          getProgressValue(
            progressData
          ) ??
          getProgressValue(
            trainingData
          ) ??
          getProgressValue(
            dashboardData
          );

        if (
          apiValue !== null
        ) {
          return apiValue;
        }

        if (
          totalWorkouts <= 0
        ) {
          return 0;
        }

        return Math.min(
          100,
          Math.round(
            (
              completedWorkouts /
              totalWorkouts
            ) *
              100
          )
        );
      },
      [
        progressData,
        trainingData,
        dashboardData,
        totalWorkouts,
        completedWorkouts,
      ]
    );

  /*
  =======================================================
  STREAK
  =======================================================
  */

  const streak = useMemo(
    () => {
      const apiValue =
        getStreakValue(
          progressData
        ) ??
        getStreakValue(
          trainingData
        ) ??
        getStreakValue(
          dashboardData
        );

      if (
        apiValue !== null
      ) {
        return apiValue;
      }

      return 0;
    },
    [
      progressData,
      trainingData,
      dashboardData,
    ]
  );

  /*
  =======================================================
  CLIENT LEVEL
  =======================================================
  */

  const clientLevel =
    dashboardData?.stats?.level ||
    progressData?.level ||
    progressData?.stats
      ?.level ||
    user?.level ||
    "مبتدئ";

  /*
  =======================================================
  SUBSCRIPTION
  =======================================================
  */

  const subscriptionStatus =
    dashboardData?.subscription
      ?.status ||
    dashboardData
      ?.currentSubscription
      ?.status ||
    dashboardData?.stats
      ?.subscriptionStatus ||
    user?.subscriptionStatus ||
    "غير محدد";

  const subscriptionLabel =
    (() => {
      const status =
        String(
          subscriptionStatus
        ).toLowerCase();

      if (
        [
          "active",
          "activated",
          "مفعل",
          "نشط",
          "active_subscription",
        ].includes(status)
      ) {
        return "نشط";
      }

      if (
        [
          "pending",
          "قيد الانتظار",
        ].includes(status)
      ) {
        return "قيد المراجعة";
      }

      if (
        [
          "expired",
          "منتهي",
        ].includes(status)
      ) {
        return "منتهي";
      }

      return subscriptionStatus;
    })();

  /*
  =======================================================
  LOADING
  =======================================================
  */

  if (loading) {
    return (
      <div
        className="client-dashboard-page"
        dir="rtl"
      >
        <div className="client-dashboard-loading">

          <div className="client-dashboard-loading-spinner">
            <span />
          </div>

          <h2>
            جاري تحميل بياناتك
          </h2>

          <p>
            يتم تجهيز لوحة التحكم الخاصة بك...
          </p>

        </div>
      </div>
    );
  }

  /*
  =======================================================
  PAGE
  =======================================================
  */

  return (
    <div
      className="client-dashboard-page"
      dir="rtl"
    >

      {/* HERO */}

      <section className="client-dashboard-hero">

        <div className="client-dashboard-hero-content">

          <span className="client-dashboard-eyebrow">
            GYM COACH
          </span>

          <h1>
            مرحبًا،{" "}
            <strong>
              {clientName}
            </strong>{" "}
            👋
          </h1>

          <p>
            أهلاً بك في لوحة التحكم الخاصة بك.
            تابع تدريبك وتقدمك واشتراكك من مكان واحد.
          </p>

          {error && (
            <div className="client-dashboard-error">
              {error}
            </div>
          )}

        </div>

      </section>

      {/* STATS */}

      <section className="client-dashboard-stats">

        <div className="client-dashboard-stat">

          <div className="client-dashboard-stat-icon">
            🏋️
          </div>

          <div className="client-dashboard-stat-content">

            <strong>
              {completedWorkouts}

              <span className="client-stat-divider">
                /
              </span>

              {totalWorkouts}
            </strong>

            <span>
              تمارين مكتملة
            </span>

          </div>

        </div>

        <div className="client-dashboard-stat">

          <div className="client-dashboard-stat-icon">
            🔥
          </div>

          <div className="client-dashboard-stat-content">

            <strong>
              {streak}
            </strong>

            <span>
              يوم التزام متتالي
            </span>

          </div>

        </div>

        <div className="client-dashboard-stat">

          <div className="client-dashboard-stat-icon">
            📊
          </div>

          <div className="client-dashboard-stat-content">

            <strong>
              {
                completionPercentage
              }%
            </strong>

            <span>
              نسبة الإنجاز
            </span>

          </div>

        </div>

        <div className="client-dashboard-stat">

          <div className="client-dashboard-stat-icon">
            ⭐
          </div>

          <div className="client-dashboard-stat-content">

            <strong>
              {clientLevel}
            </strong>

            <span>
              مستوى الأداء
            </span>

          </div>

        </div>

      </section>

      {/* QUICK ACCESS */}

      <section className="client-dashboard-section-header">

        <div>

          <span>
            YOUR DASHBOARD
          </span>

          <h2>
            الوصول السريع
          </h2>

        </div>

      </section>

      <section className="client-dashboard-grid">

        <Link
          to="/client/training"
          className="client-dashboard-card"
        >

          <div className="client-dashboard-card-icon">
            🏋️
          </div>

          <h3>
            التدريب
          </h3>

          <p>
            شاهد تمارينك وبرنامجك التدريبي
            وتابع مستوى إنجازك.
          </p>

          <span className="client-dashboard-card-arrow">
            ←
          </span>

        </Link>

        <Link
          to="/client/diet"
          className="client-dashboard-card"
        >

          <div className="client-dashboard-card-icon">
            🥗
          </div>

          <h3>
            النظام الغذائي
          </h3>

          <p>
            تابع خطتك الغذائية والوجبات
            المخصصة لك.
          </p>

          <span className="client-dashboard-card-arrow">
            ←
          </span>

        </Link>

        <Link
          to="/client/progress"
          className="client-dashboard-card"
        >

          <div className="client-dashboard-card-icon">
            📈
          </div>

          <h3>
            التقدم
          </h3>

          <p>
            راقب نسبة إنجازك ومستوى التزامك
            وتطورك مع الوقت.
          </p>

          <span className="client-dashboard-card-arrow">
            ←
          </span>

        </Link>

        <Link
          to="/client/subscriptions"
          className="client-dashboard-card"
        >

          <div className="client-dashboard-card-icon">
            💳
          </div>

          <h3>
            اشتراكي
          </h3>

          <p>
            حالة اشتراكك الحالية:
            <strong className="client-subscription-inline">
              {
                subscriptionLabel
              }
            </strong>
          </p>

          <span className="client-dashboard-card-arrow">
            ←
          </span>

        </Link>

      </section>

      {/* PROGRESS */}

      <section className="client-dashboard-progress">

        <div className="client-dashboard-progress-heading">

          <div>

            <span>
              YOUR PROGRESS
            </span>

            <h2>
              تقدمك الحالي
            </h2>

          </div>

          <div className="client-dashboard-progress-percentage">
            {
              completionPercentage
            }%
          </div>

        </div>

        <div
          className="client-dashboard-progress-bar"
          aria-label={`نسبة الإنجاز ${completionPercentage}%`}
        >
          <span
            style={{
              width:
                `${completionPercentage}%`,
            }}
          />
        </div>

        <div className="client-dashboard-progress-info">

          <div>

            <span>
              التمارين المكتملة
            </span>

            <strong>
              {completedWorkouts}
            </strong>

          </div>

          <div>

            <span>
              إجمالي التمارين
            </span>

            <strong>
              {totalWorkouts}
            </strong>

          </div>

          <div>

            <span>
              أيام الالتزام
            </span>

            <strong>
              {streak}
            </strong>

          </div>

          <div>

            <span>
              الاشتراك
            </span>

            <strong>
              {
                subscriptionLabel
              }
            </strong>

          </div>

        </div>

        {totalWorkouts ===
          0 && (
          <div className="client-dashboard-no-progress">

            <span>
              📋
            </span>

            <div>

              <strong>
                لم يتم إضافة برنامج تدريبي بعد
              </strong>

              <p>
                عندما يقوم المدرب بإضافة برنامجك
                التدريبي ستظهر بيانات الإنجاز هنا.
              </p>

            </div>

            <Link
              to="/client/training"
            >
              الذهاب للتدريب
            </Link>

          </div>
        )}

      </section>

      <div className="client-dashboard-status">

        <span className="client-status-dot" />

        <span>
          بيانات التقدم محدثة من برنامجك التدريبي
        </span>

      </div>

    </div>
  );
}

/*
=========================================================
CLIENT PROGRESS
=========================================================
*/

function ClientProgress() {
  const [data, setData] =
    useState(null);

  const [
    trainingData,
    setTrainingData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProgress =
      async () => {
        try {
          const token =
            getToken();

          const headers = {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          };

          const [
            progressResponse,
            trainingResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/progress`,
                {
                  headers,
                }
              ),

              fetch(
                `${API_URL}/training/my-program`,
                {
                  headers,
                }
              ),
            ]);

          const progressResult =
            await progressResponse
              .json()
              .catch(
                () => ({})
              );

          const trainingResult =
            await trainingResponse
              .json()
              .catch(
                () => ({})
              );

          if (!mounted) {
            return;
          }

          if (
            progressResponse.ok
          ) {
            setData(
              progressResult
            );
          }

          if (
            trainingResponse.ok
          ) {
            setTrainingData(
              trainingResult
            );
          }
        } catch {
          /*
            خطأ تحميل بيانات التقدم لا يوقف
            بقية واجهة الصفحة.
          */
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    loadProgress();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="client-placeholder-page"
        dir="rtl"
      >

        <span>
          📊
        </span>

        <h1>
          جاري تحميل التقدم...
        </h1>

      </div>
    );
  }

  const calculated =
    calculateTrainingStats(
      trainingData
    );

  const progress =
    getProgressValue(
      data
    ) ??
    getProgressValue(
      trainingData
    ) ??
    calculated.percentage;

  const completed =
    getCompletedWorkouts(
      data
    ) ??
    getCompletedWorkouts(
      trainingData
    ) ??
    calculated.completed;

  const total =
    getTotalWorkouts(
      data
    ) ??
    getTotalWorkouts(
      trainingData
    ) ??
    calculated.total;

  const streak =
    getStreakValue(
      data
    ) ??
    getStreakValue(
      trainingData
    ) ??
    0;

  return (
    <div
      className="client-progress-page"
      dir="rtl"
    >

      <div className="client-progress-header">

        <span>
          YOUR PROGRESS
        </span>

        <h1>
          تقدمك
        </h1>

        <p>
          تابع مستوى إنجازك والتزامك بالتدريب.
        </p>

      </div>

      <div className="client-progress-main-card">

        <div
          className="client-progress-circle"
          style={{
            "--client-progress":
              `${progress * 3.6}deg`,
          }}
        >

          <div>

            <strong>
              {progress}%
            </strong>

            <span>
              الإنجاز
            </span>

          </div>

        </div>

        <div className="client-progress-details">

          <div>

            <span>
              التمارين المكتملة
            </span>

            <strong>
              {completed}
            </strong>

          </div>

          <div>

            <span>
              إجمالي التمارين
            </span>

            <strong>
              {total}
            </strong>

          </div>

          <div>

            <span>
              أيام الالتزام
            </span>

            <strong>
              {streak}
            </strong>

          </div>

        </div>

      </div>

    </div>
  );
}

/*
=========================================================
APP
=========================================================
*/

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* LOGIN */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />

        <Route
          path="/reset-password"
          element={
            <ResetPassword />
          }
        />

        {/* ADMIN AREA */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
              ]}
            >
              <AdminLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/dashboard"
            element={
              <Dashboard />
            }
          />

          <Route
            path="/packages"
            element={
              <Packages />
            }
          />

          <Route
            path="/clients"
            element={
              <Clients />
            }
          />

          <Route
            path="/transformations"
            element={
              <Transformations />
            }
          />

          <Route
            path="/subscription-requests"
            element={
              <SubscriptionRequests />
            }
          />

          <Route
            path="/admin-chat"
            element={
              <AdminChat />
            }
          />

        </Route>

        {/* CLIENT AREA */}

        <Route
          path="/client"
          element={
            <ProtectedRoute
              allowedRoles={[
                "client",
              ]}
            >
              <ClientLayout />
            </ProtectedRoute>
          }
        >

          {/* CLIENT DASHBOARD */}

          <Route
            index
            element={
              <ClientHome />
            }
          />

          {/* CLIENT TRAINING */}

          <Route
            path="training"
            element={
              <ClientTraining />
            }
          />

          {/* CLIENT DIET */}

          <Route
            path="diet"
            element={
              <ClientNutrition />
            }
          />

          {/* CLIENT PROGRESS */}

          <Route
            path="progress"
            element={
              <ClientProgress />
            }
          />

          {/* CLIENT PACKAGES */}

          <Route
            path="packages"
            element={
              <ClientPackages />
            }
          />

          {/* CLIENT SUBSCRIPTIONS */}

          <Route
            path="subscriptions"
            element={
              <ClientSubscriptions />
            }
          />

          {/* CLIENT CHAT */}

          <Route
            path="chat"
            element={
              <ClientChat />
            }
          />

        </Route>

        {/* OLD CLIENT LINKS */}

        <Route
          path="/client-training"
          element={
            <Navigate
              to="/client/training"
              replace
            />
          }
        />

        <Route
          path="/client-nutrition"
          element={
            <Navigate
              to="/client/diet"
              replace
            />
          }
        />

        <Route
          path="/client-packages"
          element={
            <Navigate
              to="/client/packages"
              replace
            />
          }
        />

        {/* DEFAULT ROUTES */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        {/* UNKNOWN ROUTE */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;