# 🗕️ Event Management Platform - Technical Documentation

## 🔍 Overview

A full-stack event management platform enabling users to book services provided by vendors. It includes user authentication, role-based authorization, vendor offers, admin control, reviews, support tickets, and Razorpay integration for secure payments.

---

## ✨ Features Summary

### 👥 User Roles

- **Admin**: Manages users, vendors, categories, approvals
- **Vendor**: Offers services, manages gallery and availability
- **User**: Books services, reviews, raises tickets

### 🔐 Authentication & Security

- JWT-based login with OTP verification via Twilio
- Rate limiting middleware for security
- Admin-only protected routes

### 💬 OTP & Verification

- Twilio used for phone verification on registration and login
- Retry/Resend options with attempt limits and block mechanisms
- OTP-based password reset with expiry and limit checks

### 🧢 Email Notifications

- Nodemailer integrated for automatic email notifications
  - Vendor approval/rejection
  - Password reset
  - Support ticket status updates

### 🚨 Block/Unblock Mechanism

- Admin can block/unblock users with timestamp and audit logging
- Blocked users are denied access to protected functionalities
- Admin can block users from admin dashboard and store reason and actor details

### 🧲 Booking System

- Users book vendor services for specific dates
- Vendors confirm/cancel/complete the bookings
- Razorpay used for payments

### 🖼️ Image Handling

- Image uploads via Cloudinary
- `multer` middleware used for single/multiple image handling

### 🛎️ Support System

- Authenticated users can raise support tickets
- Admin views & updates ticket status (open, in-progress, resolved, closed)
- Ticket-based communication & email alerts

---

## 📁 Folder Structure (Backend)

```
backend/
├── controllers/
├── middleware/
├── models/
├── routes/
├── utils/
├── server.js
└── config/
```

---

## 🧠 Mongoose Data Models

### 👤 User

- Fields: name, email, phone, password, role, category, businessName, profilePhoto, galleryImages, isApproved, isBlocked, wishlist, availability
- Features: OTP fields, block/unblock audit, password reset, verification attempt limits, phone verification

### 📆 Category

- title, slug, image, subCategories[]
- Admin adds categories with subcategories from dashboard

### 🛠️ Service

- vendor, title, description, minPrice, maxPrice, category, subCategory, tags[], location, phone, images[], contact/social info

### 🎫 Booking

- user, vendor, service, message, date, status, paymentStatus, amount
- Auto-expiry for unpaid bookings (30 mins)

### 💸 Payment

- vendor, user, booking, amount, status, Razorpay order/payment/signature IDs

### 🏷️ Offer

- vendor, service, title, description, originalPrice, discountedPrice, validFrom, validTill, isActive
- Auto validation for price/date ranges

### ⭐ Review

- user, vendor, service, rating, comment
- Aggregates: averageRating, totalReviews
- One review per user per service

### 🎣️ SupportTicket

- name, email, phone, subject, category, description, status, user

---

## 🚦 API Routes Overview

### 🔑 Auth (controllers/auth.Controller.js)

- POST `/register`, `/login`, `/logout`
- POST `/send-otp`, `/verify-otp`, `/resend-login-otp`, `/verify-login-otp`
- GET `/me`, PUT `/update-profile`, `/update-gallery`
- Admin routes: GET/PUT/DELETE `/users`, PUT `/users/:id/approval`
- OTP-based password reset: `/forgot-password`, `/reset-password`

### 🦾 Admin (controllers/admin.Controller.js)

- GET `/vendors`, PUT `/vendors/:id/approve` (sends email notification)
- POST/GET/PUT/DELETE `/categories` (Admin adds category and subcategories)
- GET `/offers`, `/offers/:id`
- PUT `/users/:id/block`, `/users/:id/unblock` (Admin can block/unblock users)

### 💳 Booking (controllers/booking.Controller.js)

- POST `/` (create booking)
- GET `/vendor/:id`, `/user/:id`
- PUT `/:id/status`

### 🏡 Offers (controllers/vendor.Controller.js)

- POST `/` (create), GET `/my-offers`
- PUT/DELETE `/:id`, PUT `/:id/toggle-status`

### 💰 Payments (controllers/payment.Controller.js)

- POST `/create-order`, `/verify`

### ⭐ Reviews (controllers/review\.Controller.js)

- GET `/service/:serviceId`, `/vendor/:vendorId`
- POST/PUT/DELETE `/`

### 🛠️ Services (controllers/service.Controller.js)

- POST `/`, GET `/vendor/:vendorId`, PUT/DELETE `/:id`
- GET `/category/:category`, `/search`, `/all`, `/:id`

### 🎫 Support (controllers/support.Controller.js)

- POST `/`, GET `/`, `/:id`, PUT `/:id/status`
- Email sent on ticket status change

### ❤️ Wishlist (controllers/wishlist.Controller.js)

- GET `/`, POST/DELETE `/:serviceId`

### 👤 Vendor Public (controllers/vendor.Controller.js)

- GET `/`, `/:id`
- PUT `/:id` (update profile)
- POST/DELETE `/:id/gallery`, `/gallery/delete`

---

## 🌐 Cloudinary

- Upload & destroy images using `cloudinary.uploader.upload()` and `.destroy()`
- Integrated with multer middleware: `uploadSingleImage`, `uploadMultipleImages`

## 🔐 Razorpay Integration

- Create Razorpay order: `/create-order`
- Verify payment signature: `/verify`

## 📧 Email Service (Nodemailer)

- Automatic email alerts:
  - Vendor approval/rejection
  - OTP/password reset instructions
  - Support ticket status updates

---

## 📊 Tech Stack

### Backend

- Node.js + Express.js
- MongoDB + Mongoose
- JWT Auth, OTP (Twilio), Nodemailer, Cloudinary, Razorpay

### Frontend (not included)

- Expected React-based with Tailwind
- Role-based views: User, Vendor, Admin

---

## 🏢 Company Identity

**Company Name:** Eventloop\
**Location:** Bhubaneswar, Patia, Odisha, India\
**Built By:** @Daya Consultancy Service

---

## 🗓️ License

MIT License 2025 © Eventloop

