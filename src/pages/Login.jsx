import API_URL from "../config/api";
import { useEffect, useState } from "react";
import "./Login.css";

function Login() {
  const [mode, setMode] =
    useState("login");

  const [showLoginPassword, setShowLoginPassword] =
    useState(false);

  const [showRegisterPassword, setShowRegisterPassword] =
    useState(false);

  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);

  const [registerPhone, setRegisterPhone] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [forgotEmail, setForgotEmail] =
    useState("");

  const [registerName, setRegisterName] =
    useState("");

  const [registerEmail, setRegisterEmail] =
    useState("");

  const [registerPassword, setRegisterPassword] =
    useState("");

  const [
    registerConfirmPassword,
    setRegisterConfirmPassword,
  ] = useState("");

  const [
    transformations,
    setTransformations,
  ] = useState([]);

  const [
    loadingTransformations,
    setLoadingTransformations,
  ] = useState(true);

  const [loading, setLoading] =
    useState(false);

  /*
  ========================================
  جلب التحولات العامة
  ========================================
  */

  useEffect(() => {
    const fetchTransformations =
      async () => {
        try {
          setLoadingTransformations(
            true
          );

          const response =
            await fetch(
              `${API_URL}/transformations`
            );

          const data =
            await response.json();

          if (!response.ok) {
            setTransformations([]);
            return;
          }

          if (data.success) {
            setTransformations(
              data.transformations ||
                []
            );
          } else {
            setTransformations([]);
          }
        } catch {
          setTransformations([]);
        } finally {
          setLoadingTransformations(
            false
          );
        }
      };

    fetchTransformations();
  }, []);

  /*
  ========================================
  إنشاء رابط الصورة
  ========================================
  */

  const getImageUrl = (
    imageUrl
  ) => {
    if (!imageUrl) {
      return "";
    }

    if (
      imageUrl.startsWith(
        "http://"
      ) ||
      imageUrl.startsWith(
        "https://"
      )
    ) {
      return imageUrl;
    }

    return `${API_URL}${imageUrl}`;
  };

  /*
  ========================================
  الانتقال إلى تسجيل الدخول
  ========================================
  */

  const scrollToLogin = () => {
    setMode("login");

    setTimeout(() => {
      document
        .getElementById(
          "login-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  };

  /*
  ========================================
  الانتقال إلى التسجيل
  ========================================
  */

  const openRegister = () => {
    setMode("register");

    setTimeout(() => {
      document
        .getElementById(
          "login-section"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  };

  const finishLogin = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    if (data.user.role === "admin") {
      window.location.href = "/dashboard";
      return;
    }

    if (data.user.role === "client") {
      window.location.href = "/client";
      return;
    }

    setErrorMessage("نوع الحساب غير معروف");
  };

  /*
  ========================================
  تسجيل الدخول
  ========================================
  */

  const handleLogin = async (event) => {
    event.preventDefault();
    setNotice("");
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || "بيانات تسجيل الدخول غير صحيحة.");
        return;
      }

      finishLogin(data);
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  /*
  ========================================
  نسيت كلمة المرور
  ========================================
  */

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setNotice("");
    setErrorMessage("");

    if (!forgotEmail.trim()) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/request-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || "تعذر إرسال رمز التحقق.");
        return;
      }

      window.location.href = `/reset-password?email=${encodeURIComponent(forgotEmail.trim())}`;
    } catch {
      setErrorMessage("تعذر الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  /*
  ========================================
  إنشاء حساب عميل
  ========================================
  */

  const handleRegister =
    async (event) => {
      event.preventDefault();

      if (
        !registerName.trim() ||
        !registerEmail.trim() ||
        !registerPassword
      ) {
        setErrorMessage(
          "يرجى إدخال جميع البيانات المطلوبة"
        );

        return;
      }

      if (
        registerPassword.length <
        6
      ) {
        setErrorMessage(
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
        );

        return;
      }

      if (
        registerPassword !==
        registerConfirmPassword
      ) {
        setErrorMessage(
          "كلمتا المرور غير متطابقتين"
        );

        return;
      }

      try {
        setLoading(true);

        const response =
          await fetch(
            `${API_URL}/auth/register`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                name:
                  registerName.trim(),

                email:
                  registerEmail.trim(),

                phone:
                  registerPhone.trim(),

                password:
                  registerPassword,

                role: "client",
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setErrorMessage(
            data.message ||
              "حدث خطأ أثناء إنشاء الحساب"
          );

          return;
        }

        setNotice(
          data.message ||
            "تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول."
        );

        setEmail(
          registerEmail
        );

        setRegisterName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setRegisterConfirmPassword(
          ""
        );
        setRegisterPhone("");

        setMode("login");
      } catch {
        setErrorMessage(
          "تعذر الاتصال بالسيرفر"
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  ========================================
  الصفحة
  ========================================
  */

  return (
    <div
      className="landing-page"
      dir="rtl"
    >

      {/* ========================================
          NAVBAR
      ======================================== */}

      <header className="landing-navbar">

        <div className="landing-logo">

          <div className="landing-logo-icon">
            GC
          </div>

          <div>

            <strong>
              GYM
            </strong>

            <span>
              COACH
            </span>

          </div>

        </div>

        <nav className="landing-nav">

          <a href="#home">
            الرئيسية
          </a>

          <a href="#features">
            المميزات
          </a>

          <a href="#transformations">
            التحولات
          </a>

          <button
            type="button"
            className="nav-login-button"
            onClick={
              scrollToLogin
            }
          >
            تسجيل الدخول
          </button>

        </nav>

      </header>

      {/* ========================================
          HERO
      ======================================== */}

      <section
        id="home"
        className="landing-hero"
      >

        <div className="hero-content">

          <div className="hero-badge">

            <span>
              🏆
            </span>

            <span>
              طريقك إلى جسم أفضل يبدأ هنا
            </span>

          </div>

          <h1>

            ابنِ جسمك

            <br />

            <span>
              وطوّر مستواك
            </span>

          </h1>

          <p>
            منصة تدريب متكاملة تجمع بين
            البرامج التدريبية، الأنظمة الغذائية
            ومتابعة تقدمك مع مدربك في مكان واحد.
          </p>

          <div className="hero-actions">

            <button
              type="button"
              className="primary-hero-button"
              onClick={
                openRegister
              }
            >
              ابدأ رحلتك الآن

              <span>
                ←
              </span>

            </button>

            <button
              type="button"
              className="secondary-hero-button"
              onClick={
                scrollToLogin
              }
            >
              لدي حساب بالفعل
            </button>

          </div>

          <div className="hero-stats">

            <div>
              <strong>
                100%
              </strong>

              <span>
                متابعة مستمرة
              </span>
            </div>

            <div>
              <strong>
                🏋️
              </strong>

              <span>
                برامج تدريبية
              </span>
            </div>

            <div>
              <strong>
                🥗
              </strong>

              <span>
                أنظمة غذائية
              </span>
            </div>

          </div>

        </div>

        <div className="hero-visual">

          <div className="hero-glow"></div>

          <div className="hero-card-main">

            <div className="hero-card-top">

              <span>
                GYM COACH
              </span>

              <span>
                ✦
              </span>

            </div>

            <div className="hero-card-icon">
              🏋️
            </div>

            <h3>
              جاهز للتغيير؟
            </h3>

            <p>
              خطتك التدريبية والغذائية
              أصبحت في مكان واحد.
            </p>

            <div className="hero-progress">

              <div className="hero-progress-title">

                <span>
                  تقدمك
                </span>

                <strong>
                  78%
                </strong>

              </div>

              <div className="hero-progress-bar">

                <span></span>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ========================================
          FEATURES
      ======================================== */}

      <section
        id="features"
        className="features-section"
      >

        <div className="section-heading">

          <span>
            لماذا GYM COACH؟
          </span>

          <h2>

            كل ما تحتاجه

            <br />

            <strong>
              في مكان واحد
            </strong>

          </h2>

          <p>
            لا تحتاج إلى أكثر من منصة واحدة
            لمتابعة رحلتك الرياضية بالكامل.
          </p>

        </div>

        <div className="features-grid">

          <div className="feature-card">

            <div className="feature-icon">
              🏋️
            </div>

            <h3>
              برامج تدريبية
            </h3>

            <p>
              احصل على برنامج تدريبي منظم
              يتضمن الأيام والتمارين والفيديوهات
              الخاصة بكل تمرين.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              🥗
            </div>

            <h3>
              نظام غذائي
            </h3>

            <p>
              تابع وجباتك اليومية والسعرات
              والبروتين والكربوهيدرات والدهون
              بسهولة.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              📊
            </div>

            <h3>
              متابعة التقدم
            </h3>

            <p>
              تابع تطورك ونتائجك باستمرار
              واعرف مدى تقدمك نحو هدفك.
            </p>

          </div>

          <div className="feature-card">

            <div className="feature-icon">
              💬
            </div>

            <h3>
              تواصل مع المدرب
            </h3>

            <p>
              تواصل مباشرة مع مدربك واسأل
              عن أي شيء يخص التدريب أو التغذية.
            </p>

          </div>

        </div>

      </section>

      {/* ========================================
          TRANSFORMATIONS
      ======================================== */}

      <section
        id="transformations"
        className="transformations-section"
      >

        <div className="section-heading">

          <span>
            النتائج تتحدث عن نفسها
          </span>

          <h2>

            تحولات

            <strong>
              نفتخر بها
            </strong>

          </h2>

          <p>
            شاهد بعض النتائج والأعمال التي
            يضيفها المدرب على المنصة.
          </p>

        </div>

        {loadingTransformations ? (

          <div className="transformations-loading">

            <div>
              📸
            </div>

            <p>
              جاري تحميل التحولات...
            </p>

          </div>

        ) : transformations.length ===
          0 ? (

          <div className="transformations-empty">

            <div>
              📸
            </div>

            <h3>
              قريبًا ستظهر النتائج هنا
            </h3>

            <p>
              سيتم عرض صور التحولات والأعمال
              التي يضيفها المدرب في هذا القسم.
            </p>

          </div>

        ) : (

          <div className="transformations-grid">

            {transformations.map(
              (
                item,
                index
              ) => {

                const imageUrl =
                  getImageUrl(
                    item.image_url ||
                      item.image
                  );

                return (
                  <div
                    className="transformation-card"
                    key={
                      item.id ||
                      index
                    }
                  >

                    {imageUrl ? (

                      <img
                        src={
                          imageUrl
                        }
                        alt={
                          item.title ||
                          "تحول رياضي"
                        }
                        loading="lazy"
                        onError={(
                          event
                        ) => {
                          event.currentTarget.style.display =
                            "none";
                        }}
                      />

                    ) : (

                      <div className="transformation-placeholder">
                        📸
                      </div>

                    )}

                    <div className="transformation-overlay">

                      <h3>
                        {item.title ||
                          "نتيجة مميزة"}
                      </h3>

                      {item.description && (
                        <p>
                          {
                            item.description
                          }
                        </p>
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </section>

      {/* ========================================
          CTA
      ======================================== */}

      <section className="landing-cta">

        <div>

          <span>
            مستعد تبدأ؟
          </span>

          <h2>

            اجعل هدفك

            <br />

            واقعًا اليوم.

          </h2>

          <p>
            أنشئ حسابك وابدأ رحلتك الرياضية
            مع GYM COACH.
          </p>

        </div>

        <button
          type="button"
          onClick={
            openRegister
          }
        >
          إنشاء حساب جديد

          <span>
            ←
          </span>

        </button>

      </section>

      {/* ========================================
          LOGIN / REGISTER
      ======================================== */}

      <section
        id="login-section"
        className="auth-section"
      >

        <div className="auth-wrapper">

          <div className="auth-intro">

            <div className="auth-brand">
              GYM
              <span>COACH</span>
            </div>

            {mode === "login" ? (
              <>
                <span className="auth-label">مرحبًا بعودتك</span>
                <h2>
                  ابدأ من حيث
                  <br />
                  <strong>توقفت.</strong>
                </h2>
                <p>
                  سجل الدخول للوصول إلى برنامجك التدريبي ونظامك الغذائي ومتابعة تقدمك.
                </p>
              </>
            ) : mode === "forgot" ? (
              <>
                <span className="auth-label">استعادة الحساب</span>
                <h2>
                  نسيت كلمة
                  <br />
                  <strong>المرور؟</strong>
                </h2>
                <p>
                  سنرسل لك رمز تحقق من 6 أرقام عبر البريد الإلكتروني أو رقم الموبايل حسب اختيارك.
                </p>
              </>
            ) : (
              <>
                <span className="auth-label">خطوة جديدة</span>
                <h2>
                  ابدأ رحلتك
                  <br />
                  <strong>الرياضية.</strong>
                </h2>
                <p>
                  أنشئ حسابك كعميل وابدأ رحلتك مع GYM COACH.
                </p>
              </>
            )}

          </div>

          <div className="auth-box">

            {(notice || errorMessage) && (
              <div className={`auth-message ${errorMessage ? "error" : "success"}`} role="status">
                <span>{errorMessage ? "!" : "✓"}</span>
                <p>{errorMessage || notice}</p>
                <button type="button" onClick={() => { setNotice(""); setErrorMessage(""); }} aria-label="إغلاق">×</button>
              </div>
            )}

            <div className="auth-switch">

              <button
                type="button"
                className={
                  mode ===
                  "login"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setMode("login");
                  setNotice("");
                  setErrorMessage("");
                }}
              >
                تسجيل الدخول
              </button>

              <button
                type="button"
                className={
                  mode ===
                  "register"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setMode("register");
                  setNotice("");
                  setErrorMessage("");
                }}
              >
                إنشاء حساب
              </button>

            </div>

            {mode === "login" ? (
              <form
                className="auth-form"
                onSubmit={
                  handleLogin
                }
              >

                <h3>
                  تسجيل الدخول
                </h3>

                <p className="auth-form-description">
                  أدخل بيانات حسابك للمتابعة.
                </p>

                <label>
                  البريد الإلكتروني أو رقم الموبايل
                </label>

                <input
                  type="text"
                  inputMode="email"
                  placeholder="example@email.com أو 010..."
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
                    )
                  }
                  required
                />

                <label>
                  كلمة المرور
                </label>

                <div className="password-field">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowLoginPassword((value) => !value)}>
                    {showLoginPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "جاري الدخول..."
                    : "دخول إلى حسابي"}
                </button>

                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setForgotEmail(
                      email.trim()
                    );
                    setMode("forgot");
                  }}
                >
                  نسيت كلمة المرور؟
                </button>

                <p className="auth-bottom-text">

                  ليس لديك حساب؟

                  <button
                    type="button"
                    onClick={() =>
                      setMode(
                        "register"
                      )
                    }
                  >
                    إنشاء حساب جديد
                  </button>

                </p>

              </form>

            ) : mode === "forgot" ? (

              <form
                className="auth-form"
                onSubmit={
                  handleForgotPassword
                }
              >

                <h3>
                  استعادة كلمة المرور
                </h3>

                <p className="auth-form-description">
                  سنرسل رمز تحقق من 6 أرقام إلى بريدك الإلكتروني.
                </p>

                <label>
                  البريد الإلكتروني
                </label>

                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="example@email.com"
                  value={
                    forgotEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setForgotEmail(
                      event.target.value
                    )
                  }
                  required
                />

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "جاري الإرسال..."
                    : "إرسال رمز التحقق"}
                </button>

                <p className="auth-bottom-text">
                  تذكرت كلمة المرور؟
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                        }}
                  >
                    العودة لتسجيل الدخول
                  </button>
                </p>

              </form>

            ) : (

              <form
                className="auth-form"
                onSubmit={
                  handleRegister
                }
              >

                <h3>
                  إنشاء حساب جديد
                </h3>

                <p className="auth-form-description">
                  أنشئ حسابك وابدأ رحلتك الرياضية.
                </p>

                <label>
                  الاسم
                </label>

                <input
                  type="text"
                  placeholder="اكتب اسمك"
                  value={
                    registerName
                  }
                  onChange={(
                    event
                  ) =>
                    setRegisterName(
                      event.target
                        .value
                    )
                  }
                  required
                />

                <label>
                  البريد الإلكتروني
                </label>

                <input
                  type="email"
                  placeholder="example@email.com"
                  value={
                    registerEmail
                  }
                  onChange={(
                    event
                  ) =>
                    setRegisterEmail(
                      event.target
                        .value
                    )
                  }
                  required
                />

                <label>
                  رقم الموبايل <span className="optional-label">(اختياري لإرسال OTP)</span>
                </label>

                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="01012345678"
                  value={registerPhone}
                  onChange={(event) => setRegisterPhone(event.target.value)}
                />

                <label>
                  كلمة المرور
                </label>

                <div className="password-field">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    placeholder="6 أحرف على الأقل"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowRegisterPassword((value) => !value)}>
                    {showRegisterPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>

                <label>
                  تأكيد كلمة المرور
                </label>

                <div className="password-field">
                  <input
                    type={showRegisterConfirmPassword ? "text" : "password"}
                    placeholder="أعد كتابة كلمة المرور"
                    value={registerConfirmPassword}
                    onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowRegisterConfirmPassword((value) => !value)}>
                    {showRegisterConfirmPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "جاري إنشاء الحساب..."
                    : "إنشاء حسابي"}
                </button>

                <p className="auth-bottom-text">

                  لديك حساب بالفعل؟

                  <button
                    type="button"
                    onClick={() =>
                      setMode(
                        "login"
                      )
                    }
                  >
                    تسجيل الدخول
                  </button>

                </p>

              </form>

            )}

          </div>

        </div>

      </section>

      {/* ========================================
          FOOTER
      ======================================== */}

      <footer className="landing-footer">

        <div className="landing-logo">

          <div className="landing-logo-icon">
            GC
          </div>

          <div>

            <strong>
              GYM
            </strong>

            <span>
              COACH
            </span>

          </div>

        </div>

        <p>
          منصتك المتكاملة للتدريب والتغذية
          وتحقيق أفضل نسخة منك.
        </p>

        <span>
          ©{" "}
          {new Date().getFullYear()}{" "}
          GYM COACH
        </span>

      </footer>

    </div>
  );
}

export default Login;