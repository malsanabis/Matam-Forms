# مأتم السنابس — Firebase Setup Guide

## 📁 Project Files
```
sanabis-firebase/
├── index.html          → الموقع
├── styles.css          → التصميم
├── app.js              → المنطق والكود
├── firebase-config.js  → ⚠️ أنت تملأ هذا (لا يُرفع على GitHub)
├── firestore.rules     → قواعد الأمان (ترفعها على Firebase)
├── .gitignore          → يمنع رفع firebase-config.js على GitHub
└── README.md           → هذا الملف
```

---

## 🔥 الخطوة 1 — إنشاء مشروع Firebase

1. اذهب إلى → https://console.firebase.google.com
2. اضغط **Add project**
3. سمّه مثلاً: `sanabis-matam`
4. أوقف Google Analytics (مش محتاجه) ← اضغط **Create project**
5. انتظر ثوانٍ حتى يتحضر

---

## 🗄️ الخطوة 2 — تفعيل Firestore

1. من القائمة اليسرى → **Firestore Database**
2. اضغط **Create database**
3. اختر **Start in test mode** ← اضغط **Next**
4. اختر أقرب region: **`europe-west1`** (Frankfurt) ← اضغط **Enable**
5. انتظر حتى يتحضر

---

## 📋 الخطوة 3 — نشر قواعد الأمان

1. في Firestore → اضغط تبويب **Rules**
2. احذف كل شيء فيه
3. انسخ والصق محتوى ملف `firestore.rules` من المشروع
4. اضغط **Publish**

---

## ⚙️ الخطوة 4 — الحصول على Config

1. في Firebase console → اضغط ⚙️ (Project Settings)
2. انزل لـ **Your apps**
3. اضغط أيقونة `</>` (Web)
4. سجّل اسم التطبيق مثلاً: `sanabis-web` ← اضغط **Register app**
5. ستظهر لك بيانات مثل:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sanabis-matam.firebaseapp.com",
  projectId: "sanabis-matam",
  storageBucket: "sanabis-matam.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```
6. افتح ملف **`firebase-config.js`** في المشروع
7. استبدل كل القيم بالقيم الحقيقية من Firebase
8. احفظ الملف ✅

---

## 📤 الخطوة 5 — رفع المشروع على GitHub

```bash
# في Terminal:
git init
git add index.html styles.css app.js README.md firestore.rules logo.png
# ⚠️ لاحظ: firebase-config.js غير موجود هنا عشان .gitignore يمنعه
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sanabis-forms.git
git push -u origin main
```

---

## 🌐 الخطوة 6 — تفعيل GitHub Pages

1. اذهب للـ repo على GitHub
2. **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **/ (root)**
5. اضغط **Save**
6. الموقع سيكون جاهزاً خلال دقيقتين على:
   `https://YOUR_USERNAME.github.io/sanabis-forms/`

---

## 💻 الخطوة 7 — التشغيل المحلي (للتجربة)

بما إن الموقع يستخدم Firebase، ما يشتغل بمجرد فتح الـ HTML مباشرة.
تحتاج local server بسيط:

```bash
# Python (مثبت على Mac/Linux تلقائياً):
cd sanabis-firebase
python3 -m http.server 8080
# ثم افتح: http://localhost:8080

# أو Node.js:
npx serve .
```

---

## ✅ كيف يشتغل النظام؟

```
المستخدم (موبايل)          Firebase Firestore          الأدمن (PC)
      │                           │                          │
      │── يملأ استبيان ──────────►│                          │
      │                           │◄── يقرأ في real-time ────│
      │                           │                          │
      │                    مسؤول القسم                       │
      │                           │                          │
      │◄── يقبل أو يرفض ─────────│                          │
      │                           │──── يصل للأدمن ─────────►│
```

- **كل شيء real-time** — الأدمن يشوف الاستبيانات فور إرسالها بدون refresh
- **firebase-config.js** موجود محلياً عندك فقط، مش على GitHub
- **Firestore** يحفظ كل البيانات سحابياً ومجاناً

---

## 🔐 بيانات الدخول للأدمن

| الحقل | القيمة |
|-------|--------|
| الرقم الوطني | `101010101` |
| Username | `admin` |
| Password | `admin` |

> ⚠️ غيّر هذه البيانات في `app.js` — ابحث عن `101010101` و `admin`

---

## ❓ أسئلة شائعة

**هل Firebase مجاني؟**
نعم، الـ Spark plan مجاني ويكفي بشكل كبير لهذا الاستخدام.
الحد المجاني: 50,000 قراءة و 20,000 كتابة يومياً.

**هل البيانات آمنة على GitHub؟**
نعم، `firebase-config.js` في `.gitignore` وما يُرفع أبداً.

**لو فقدت firebase-config.js؟**
ترجع Firebase console وتحصل البيانات من Project Settings.
