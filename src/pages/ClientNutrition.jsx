import API_URL from "../config/api";
import "../ClientNutrition.css";
import {
  useEffect,
  useState,
} from "react";

function ClientNutrition() {
  const [diet, setDiet] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const token =
    localStorage.getItem(
      "token"
    );

  let user = null;

  try {
    user = JSON.parse(
      localStorage.getItem(
        "user"
      ) || "null"
    );
  } catch {
    user = null;
  }

  /*
  ========================================
  LOAD DIET
  ========================================
  */

  const loadDiet = async () => {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        setError(
          "يجب تسجيل الدخول أولًا"
        );

        return;
      }

      const response =
        await fetch(
          `${API_URL}/nutrition/my-diet`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "حدث خطأ أثناء جلب النظام الغذائي"
        );

        return;
      }

      setDiet(
        data.diet || null
      );
    } catch {
      setError(
        "تعذر الاتصال بالسيرفر"
      );
    } finally {
      setLoading(false);
    }
  };

  /*
  ========================================
  INITIAL LOAD
  ========================================
  */

  useEffect(() => {
    loadDiet();
  }, []);

  /*
  ========================================
  LOGOUT
  ========================================
  */

  const logout = () => {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    window.location.href =
      "/login";
  };

  /*
  ========================================
  LOADING
  ========================================
  */

  if (loading) {
    return (
      <div
        className="client-nutrition-page"
        dir="rtl"
      >
        <div className="nutrition-loading">

          <div className="loading-icon">
            ✦
          </div>

          <div className="loading-spinner" />

          <h2>
            جاري تجهيز نظامك الغذائي
          </h2>

          <p>
            لحظات ونجهز لك خطتك الغذائية...
          </p>

        </div>
      </div>
    );
  }

  /*
  ========================================
  ERROR
  ========================================
  */

  if (error) {
    return (
      <div
        className="client-nutrition-page"
        dir="rtl"
      >
        <div className="nutrition-error">

          <div className="error-icon">
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
              loadDiet
            }
          >
            إعادة المحاولة
          </button>

        </div>
      </div>
    );
  }

  /*
  ========================================
  NO DIET
  ========================================
  */

  if (!diet) {
    return (
      <div
        className="client-nutrition-page"
        dir="rtl"
      >
        <header className="nutrition-header">

          <div className="nutrition-brand">
            <strong>
              GYM
            </strong>

            <span>
              COACH
            </span>
          </div>

          <button
            type="button"
            onClick={
              logout
            }
          >
            تسجيل الخروج
          </button>

        </header>

        <main className="nutrition-empty">

          <div className="nutrition-empty-icon">
            🥗
          </div>

          <h1>
            أهلًا{" "}
            {user?.name ||
              "بك"}
          </h1>

          <h2>
            لا يوجد نظام غذائي حاليًا
          </h2>

          <p>
            لم يقم المدرب بإضافة نظام غذائي
            لك حتى الآن.
          </p>

          <p>
            سيظهر نظامك الغذائي هنا بمجرد
            أن يقوم المدرب بتخصيصه لك.
          </p>

        </main>
      </div>
    );
  }

  /*
  ========================================
  MAIN
  ========================================
  */

  return (
    <div
      className="client-nutrition-page"
      dir="rtl"
    >
      <header className="nutrition-header">

        <div className="nutrition-brand">

          <strong>
            GYM
          </strong>

          <span>
            COACH
          </span>

        </div>

        <div className="nutrition-user">

          <div className="nutrition-avatar">

            {user?.name
              ? user.name.charAt(
                  0
                )
              : "👤"}

          </div>

          <div>

            <strong>
              {user?.name ||
                "العميل"}
            </strong>

            <span>
              نظامك الغذائي
            </span>

          </div>

        </div>

        <button
          type="button"
          onClick={
            logout
          }
        >
          تسجيل الخروج
        </button>

      </header>

      <section className="nutrition-hero">

        <span>
          NUTRITION PLAN
        </span>

        <h1>
          {diet.name}
        </h1>

        {diet.description && (
          <p>
            {diet.description}
          </p>
        )}

        <div className="nutrition-line">

          <span />

          <b>
            ✦
          </b>

          <span />

        </div>

      </section>

      <main className="nutrition-content">

        {diet.meals &&
        diet.meals.length > 0 ? (
          diet.meals.map(
            (
              meal,
              index
            ) => (

              <article
                className="nutrition-meal-card"
                key={
                  meal.id ||
                  index
                }
              >

                <div className="meal-number">
                  {index + 1}
                </div>

                <div className="meal-content">

                  <span>
                    MEAL{" "}
                    {index + 1}
                  </span>

                  <h2>
                    {meal.name}
                  </h2>

                  {meal.description && (
                    <p>
                      {
                        meal.description
                      }
                    </p>
                  )}

                  <div className="meal-info">

                    {meal.calories !=
                      null && (
                      <div>

                        <span>
                          السعرات
                        </span>

                        <strong>
                          {
                            meal.calories
                          }
                        </strong>

                      </div>
                    )}

                    {meal.protein !=
                      null && (
                      <div>

                        <span>
                          البروتين
                        </span>

                        <strong>
                          {
                            meal.protein
                          }{" "}
                          جم
                        </strong>

                      </div>
                    )}

                    {meal.carbs !=
                      null && (
                      <div>

                        <span>
                          الكربوهيدرات
                        </span>

                        <strong>
                          {
                            meal.carbs
                          }{" "}
                          جم
                        </strong>

                      </div>
                    )}

                    {meal.fats !=
                      null && (
                      <div>

                        <span>
                          الدهون
                        </span>

                        <strong>
                          {
                            meal.fats
                          }{" "}
                          جم
                        </strong>

                      </div>
                    )}

                  </div>

                </div>

              </article>

            )
          )
        ) : (

          <div className="nutrition-empty">

            <div className="nutrition-empty-icon">
              🥗
            </div>

            <h2>
              لم تتم إضافة وجبات بعد
            </h2>

            <p>
              سيظهر نظامك الغذائي هنا
              بمجرد إضافة الوجبات من المدرب.
            </p>

          </div>

        )}

      </main>

      <footer className="nutrition-footer">

        <span>
          GYM COACH
        </span>

        <b>
          •
        </b>

        <span>
          EAT SMART · TRAIN HARD
        </span>

      </footer>

    </div>
  );
}

export default ClientNutrition;