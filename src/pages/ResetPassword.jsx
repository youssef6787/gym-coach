import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API_URL from "../config/api";
import "./ResetPassword.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();

  const identifier = useMemo(
    () => String(searchParams.get("email") || "").trim(),
    [searchParams]
  );

  const [step, setStep] = useState("otp");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState(
    "أدخل رمز التحقق الذي وصلك على بريدك الإلكتروني."
  );

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!identifier) {
      setError("بيانات الاستعادة غير موجودة. ابدأ العملية من صفحة تسجيل الدخول.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("أدخل رمز التحقق المكون من 6 أرقام.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, otp }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "رمز التحقق غير صحيح أو منتهي الصلاحية.");
        return;
      }

      setResetToken(data.resetToken);
      setOtp("");
      setStep("password");
      setNotice("تم التحقق بنجاح. أنشئ الآن كلمة مرور جديدة.");
    } catch {
      setError("تعذر الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/reset-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "تعذر تغيير كلمة المرور.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError("تعذر الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setNotice("");
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/auth/request-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "تعذر إعادة إرسال الرمز.");
        return;
      }
      setNotice("تم إرسال رمز تحقق جديد. الرمز السابق لم يعد صالحًا.");
    } catch {
      setError("تعذر الاتصال بالسيرفر.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="reset-password-page" dir="rtl">
      <div className="reset-password-card">
        <div className="reset-password-brand">
          <span>GC</span>
          <div>
            <strong>GYM</strong>
            <small>COACH</small>
          </div>
        </div>

        {success ? (
          <div className="reset-password-success">
            <div className="reset-password-icon">✓</div>
            <h1>تم تغيير كلمة المرور بنجاح</h1>
            <p>تم تأمين حسابك بكلمة المرور الجديدة. يمكنك الآن تسجيل الدخول بأمان.</p>
            <Link to="/" className="reset-password-button">العودة إلى تسجيل الدخول</Link>
          </div>
        ) : (
          <>
            <h1>{step === "otp" ? "تأكيد رمز الاستعادة" : "إنشاء كلمة مرور جديدة"}</h1>
            <p className="reset-password-description">{notice}</p>

            {error && (
              <div className="reset-password-error" role="alert">
                <span>!</span>{error}
              </div>
            )}

            {step === "otp" ? (
              <form onSubmit={handleVerifyOtp} className="reset-password-form">
                <label>رمز التحقق</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="otp-input-large"
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />

                <button type="submit" disabled={loading}>
                  {loading ? "جاري التحقق..." : "تأكيد الرمز"}
                </button>

                <button type="button" className="reset-password-secondary" onClick={resendOtp} disabled={loading}>
                  إعادة إرسال الرمز
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="reset-password-form">
                <label>كلمة المرور الجديدة</label>
                <div className="password-field-reset">
                  <input
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="6 أحرف على الأقل"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>

                <label>تأكيد كلمة المرور</label>
                <div className="password-field-reset">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={6}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="أعد كتابة كلمة المرور"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)}>
                    {showConfirmPassword ? "إخفاء" : "إظهار"}
                  </button>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
                </button>
              </form>
            )}

            <Link to="/" className="reset-password-back">العودة لتسجيل الدخول</Link>
          </>
        )}
      </div>
    </main>
  );
}

export default ResetPassword;
