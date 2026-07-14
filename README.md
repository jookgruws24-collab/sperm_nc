# Night Crows Growth Ranking

Ranking viewer สำหรับเกม Night Crows — React 19 + Vite + Tailwind CSS 4 (dark gaming theme, responsive)

## เริ่มใช้งาน

```bash
npm install

# Development (API :8000 + Vite dev server :5173 พร้อมกัน)
npm run dev

# Production
npm run build
npm start        # เสิร์ฟ dist/ + API ที่ http://127.0.0.1:8000
```

## โครงสร้าง

- `server.js` — API server (ดึงข้อมูลจาก nightcrows.com) + เสิร์ฟไฟล์ build
- `src/` — React frontend
  - `lib/` — config, API client (progressive loading + cache), ranking logic
  - `components/` — RankingView, CompareView, ฯลฯ
- `api/` — Vercel serverless functions (deploy บน Vercel)

## API optimizations

- **Progressive loading** — โหลด global top 1,000 ก่อน (แสดงผลได้ทันที) แล้วค่อยโหลด class rankings ตามหลัง
- **Client cache** — dataset ต่อ (type, region) โหลดครั้งเดียวต่อ session ใช้ร่วมกันทุก view
- **Server cache** — fresh 5 นาที + stale-while-revalidate 30 นาที
- **Request deduplication** — request ซ้ำที่กำลังโหลดอยู่ใช้ upstream fetch เดียวกัน
- **Gzip** — บีบอัด JSON response (~10x เล็กลง)
