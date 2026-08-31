# GYM COACH — Production Deployment

هذا المشروع عبارة عن منصة إدارة مدرب جيم وعملاء، وتشمل الحسابات، البرامج التدريبية، التمارين، التغذية، الاشتراكات والباقات، المحادثات، الإشعارات، التحولات والوسائط.

## 1) مكونات Production

- Frontend: React + Vite + Nginx
- Backend: Node.js + Express
- Database: MySQL خارجي/مدار
- Media: Cloudinary
- Email/OTP: SMTP
- Authentication: JWT + bcrypt
- API protection: Helmet + CORS + rate limiting
- Deployment: Docker Compose

## 2) مهم جدًا قبل الرفع

لا ترفع أي ملف يحتوي على أسرار أو بيانات تشغيل حقيقية:

- `.env`
- `backend/.env`
- `backend/backups/*.sql`
- `backend/uploads/*`
- `node_modules/`
- `dist/`

النسخة المرفقة للتسليم يجب أن تحتوي فقط على `.env.example` وليس بيانات الدخول الحقيقية.

**إذا تم نشر Secrets الحقيقية في أي مستودع أو تم إرسالها لشخص آخر، قم بتغييرها قبل Production.**

## 3) إعداد السيرفر

المطلوب على السيرفر:

- Docker
- Docker Compose plugin
- Domain مربوط بعنوان السيرفر
- MySQL Production (يفضل خدمة Managed MySQL)
- Cloudinary account
- SMTP account

لا تنشئ قاعدة بيانات Production داخل نفس الحاوية إلا إذا كان لديك سبب واضح وخطة Backup خارجية.

## 4) إعداد Backend secrets

انسخ:

`backend/.env.example` → `backend/.env`

ثم ضع القيم الحقيقية.

أنشئ الأسرار:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

شغّل الأمر مرتين وضع قيمة مختلفة في:

- `JWT_SECRET`
- `OTP_SECRET`

يجب أن يكون كل Secret بطول 64 حرفًا أو أكثر.

## 5) إعداد Frontend

في Docker Production يتم بناء الواجهة على:

```text
VITE_API_URL=/api
```

وهذا يجعل المتصفح يتعامل مع API من نفس الدومين عبر Nginx.

لا تضع عنوان MySQL أو أي Secret في Frontend.

## 6) تشغيل Production

بعد تجهيز `backend/.env`:

```bash
docker compose -f docker-compose.production.yml build --no-cache
```

ثم:

```bash
docker compose -f docker-compose.production.yml up -d
```

عرض الحالة:

```bash
docker compose -f docker-compose.production.yml ps
```

عرض السجلات:

```bash
docker compose -f docker-compose.production.yml logs -f backend
```

أو:

```bash
docker compose -f docker-compose.production.yml logs -f frontend
```

## 7) اختبار الصحة

بعد التشغيل:

```text
http://SERVER-IP/api/health
```

يجب أن تظهر استجابة JSON فيها `status: "ok"`.

**في النسخة النهائية يجب استخدام HTTPS والدومين، وليس HTTP غير المشفر.**

## 8) HTTPS وDomain

Docker الحالي يشغل Nginx على port 80 فقط. قبل جعل الموقع عامًا يجب وضع TLS أمامه، مثل:

- Nginx/Certbot على الـhost
- Cloudflare
- أو Load Balancer/Reverse Proxy يدعم HTTPS

بعد تفعيل HTTPS يصبح العنوان مثل:

```text
https://example.com
```

ويجب أن يكون:

```text
CORS_ORIGIN=https://example.com
FRONTEND_URL=https://example.com
```

## 9) Cloudinary

جميع الصور والفيديوهات الجديدة في Production يجب أن تعتمد على Cloudinary. يجب إكمال Migration للملفات القديمة والتحقق من تشغيلها قبل حذف النسخ المحلية القديمة.

## 10) Database Backup

تشغيل Backup يدوي:

```bash
cd backend
npm run backup:db
```

في Production يجب تشغيل النسخ الاحتياطي تلقائيًا بواسطة cron أو scheduler، ويفضل نسخ نسخة إضافية إلى تخزين خارجي مختلف عن نفس السيرفر.

## 11) التحقق قبل Production

من مجلد المشروع:

```bash
npm ci
npm run build
```

ثم:

```bash
cd backend
npm ci
NODE_ENV=production npm run verify:production
```

يجب ألا توجد أخطاء قبل النشر.

## 12) تحديث المشروع بعد النشر

بعد أي تعديل:

```bash
git pull
```

ثم:

```bash
docker compose -f docker-compose.production.yml build --no-cache
```

ثم:

```bash
docker compose -f docker-compose.production.yml up -d
```

## 13) قواعد مهمة

1. لا ترسل `backend/.env` لأي شخص.
2. لا ترفع Secrets إلى GitHub.
3. لا تضع DB credentials في React/Vite.
4. لا تحذف قاعدة البيانات قبل أخذ Backup والتحقق منه.
5. لا تحذف ملفات Cloudinary القديمة قبل اختبار تشغيلها.
6. لا تفتح MySQL للعامة إذا كان يمكن جعله متاحًا فقط من IP السيرفر.
7. لا تعتبر HTTP Production نهائيًا؛ يجب تفعيل HTTPS.

## 14) ترتيب النشر الذي سننفذه

سنقوم بالنشر تدريجيًا:

1. تجهيز السيرفر.
2. تجهيز MySQL.
3. إنشاء Secrets جديدة.
4. إعداد Cloudinary وSMTP.
5. رفع المشروع.
6. إنشاء `backend/.env` على السيرفر.
7. تشغيل Docker.
8. اختبار `/api/health`.
9. ربط الدومين.
10. تفعيل HTTPS.
11. اختبار التسجيل وتسجيل الدخول وOTP.
12. اختبار الصور والفيديو.
13. اختبار الباقات والاشتراكات.
14. اختبار Dashboard والإشعارات والمحادثات.
15. تفعيل Backup تلقائي خارجي.

**لا تنتقل للخطوة التالية قبل نجاح الخطوة الحالية.**
