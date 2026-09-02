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
