# THE LITTLE STAR — Celestial Lupus

Starter kit สำหรับเว็บไซต์สาธารณะ `celestiallupus.com` พร้อม Supabase database, RLS และระบบสมาชิกที่ใช้ username/password

## ไฟล์ในชุดนี้
- `index.html`, `styles.css`, `app.js`: หน้าเว็บเริ่มต้น
- `config.js`: ตั้งค่า Supabase URL และ publishable/anon key
- `supabase/schema.sql`: ตารางและนโยบายความปลอดภัย
- `supabase/functions/username-auth/index.ts`: Edge Function สำหรับสมัคร/เข้าสู่ระบบด้วย username/password

## สถาปัตยกรรม
- Hosting: Cloudflare Pages
- Source control: GitHub
- Database/Auth: Supabase
- Domain: `celestiallupus.com`

## ขั้นตอนติดตั้ง

### 1) สร้าง Supabase project
1. สร้างโปรเจกต์ใน Supabase Dashboard
2. เปิด SQL Editor แล้วรัน `supabase/schema.sql`
3. คัดลอก Project URL และ publishable key (หรือ anon key รุ่นเดิม) มาใส่ `config.js`
4. ห้ามนำ `service_role` key ไปใส่ใน `config.js`, HTML, GitHub หรือไฟล์ที่ส่งให้ผู้ใช้

### 2) Deploy username-auth Edge Function
ติดตั้ง Supabase CLI แล้วรันจากโฟลเดอร์โปรเจกต์:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co SUPABASE_ANON_KEY=YOUR_ANON_KEY SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase functions deploy username-auth
```
ตั้งค่า secrets ผ่าน CLI/แดชบอร์ดเท่านั้น ห้าม commit ค่า secret ลง repository

### 3) สร้างบัญชีเจ้าของเว็บและกำหนดเป็น admin
1. เปิดเว็บไซต์ผ่าน Preview URL หลังตั้งค่า Supabase แล้วสมัครบัญชีเจ้าของเว็บ
2. ใน Supabase SQL Editor ตรวจสอบ username ให้ถูกต้อง แล้วรัน:
```sql
update public.profiles
set role = 'admin'
where username = 'YOUR_OWNER_USERNAME';
```
3. อย่าเปิดสิทธิ์สมัครเป็น admin ให้ผู้ใช้ทั่วไป

### 4) เผยแพร่ผ่าน GitHub + Cloudflare Pages
1. สร้าง GitHub repository แบบ private หรือ public ตามต้องการ แล้วอัปโหลดไฟล์ชุดนี้
2. ใน Cloudflare Dashboard ไปที่ Workers & Pages → Create → Pages → Connect to Git
3. เลือก repository
4. สำหรับเว็บ static นี้ให้ตั้ง Build command ว่าง และ Build output directory เป็น `/` (หรือใช้ root directory ของ repository)
5. กด Deploy เพื่อสร้าง Preview URL
6. ใน Pages project → Custom domains เพิ่ม `celestiallupus.com` และ `www.celestiallupus.com` ตามที่ต้องการ
7. ทำตาม DNS records ที่ Cloudflare แสดงให้ครบ และรอ DNS/SSL พร้อมใช้งาน

หากโดเมนจดทะเบียนกับผู้ให้บริการอื่น ให้เปลี่ยน nameservers หรือเพิ่ม DNS records ตามวิธีที่ Cloudflare แสดง โดยตรวจสอบอีเมลและบริการเดิมก่อนเปลี่ยน nameservers

## ข้อควรทำก่อนเปิดให้สมาชิกใช้จริง
- ตั้งค่าอีเมลกู้คืนบัญชีและนโยบายการรีเซ็ตรหัสผ่าน (ปัจจุบันช่อง recovery email ถูกเก็บเป็นข้อมูลติดต่อ แต่ยังไม่มีระบบส่งลิงก์กู้คืน)
- เพิ่ม rate limiting / CAPTCHA ให้ endpoint สมัครและเข้าสู่ระบบก่อนเปิดสาธารณะ
- จำกัด CORS ให้เป็นโดเมนจริงเมื่อพร้อม
- ทดสอบว่า account A ไม่สามารถอ่าน/แก้ไข wish ของ account B ได้
- ทดสอบสิทธิ์ admin และการป้องกันการยกระดับสิทธิ์
- เพิ่มหน้า admin UI และระบบแก้ไขกิจกรรม/ภารกิจ ก่อนใช้งานจริง
- ตั้งค่า backup/retention ของ Supabase และข้อความยินยอมในการเก็บคำอธิษฐาน
- ตรวจสอบข้อกำหนดความเป็นส่วนตัว/การคุ้มครองข้อมูลส่วนบุคคลที่เกี่ยวข้อง

## ข้อจำกัดของ starter
นี่เป็นโครงสร้างเริ่มต้น ไม่ใช่ production launch ที่เสร็จสมบูรณ์: หน้า admin ยังไม่ได้ทำ, password recovery ยังไม่ได้เชื่อมอีเมล, ยังไม่ได้ตั้งค่า CAPTCHA/rate limit, ยังไม่ได้เชื่อม Supabase project และยังไม่ได้เผยแพร่โดเมน ต้องทำขั้นตอนด้านบนและทดสอบความปลอดภัยก่อนเปิดให้คนทั่วไปสมัครใช้งาน
