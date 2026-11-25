# HƯỚNG DẪN CẤU HÌNH BOT TELEGRAM (`@BotFather`) & KIỂM THỬ LỆNH — COFFEE TRACKER

Tài liệu này hướng dẫn từng bước cấu hình hồ sơ, menu lệnh bấm nhanh trên ứng dụng Telegram bằng `@BotFather` và kiểm tra kết nối trực tiếp với hệ thống `coffee-tracker` (bot hiện tại đang hoạt động: **`@minhmh_coffee_tracker_bot`**).

---

## Phần 1 — Tạo Bot mới & Cấu hình trên Telegram qua `@BotFather`

> **Lưu ý:** Nếu bạn đã có sẵn `TELEGRAM_BOT_TOKEN` của `@minhmh_coffee_tracker_bot` trong file `.env`, bạn **không cần** chạy lại `/newbot` mà chỉ cần mở `@BotFather` để chỉnh tên, mô tả, ảnh đại diện và menu lệnh ở bước **1.2**.

### 1.1 Tạo Bot mới từ đầu (`/newbot`) — Dành cho lần đầu hoặc nhân bản sang tài khoản khác

1. Mở ứng dụng **Telegram** trên điện thoại hoặc máy tính.
2. Tìm tài khoản chính thức **`@BotFather`** (có dấu tích xanh xác minh).
3. Nhấn **Start** và gửi lệnh:
   ```text
   /newbot
   ```
4. Nhập **tên hiển thị (Display Name)** cho Bot, ví dụ:
   ```text
   Coffee Tracker Tây Nguyên
   ```
5. Nhập **username** cho Bot (bắt buộc kết thúc bằng `bot` và không dấu, duy nhất toàn hệ thống Telegram), ví dụ:
   ```text
   coffee_tracker_taynguyen_bot
   ```
6. `@BotFather` sẽ trả về **HTTP API Token** (dạng `1234567890:AAF...`). Hãy lưu giữ bí mật chuỗi Token này — tuyệt đối không đưa lên Git.

---

### 1.2 Cấu hình Hồ sơ & Menu Lệnh Bấm nhanh (Copy-Paste từng bước vào `@BotFather`)

Nhắn lần lượt từng lệnh sau cho `@BotFather` (chọn bot `@minhmh_coffee_tracker_bot` khi `@BotFather` hỏi):

1. **Đặt tên hiển thị (`/setname`):**
   - Gửi `/setname` -> chọn bot -> gửi nội dung:
   ```text
   Coffee Tracker Tây Nguyên
   ```

2. **Đặt lời giới thiệu khi mở Bot lần đầu (`/setdescription` — hiện trước khi bấm Start):**
   - Gửi `/setdescription` -> chọn bot -> dán đoạn sau:
   ```text
   Bản tin thị trường cà phê Tây Nguyên hằng ngày lúc 06:00 sáng: cập nhật giá thu mua Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông, sàn London Robusta, thời tiết phơi sấy, nhận định thị trường và dự báo xu hướng 6 tháng. Bấm BẮT ĐẦU (/start) để đăng ký miễn phí.
   ```

3. **Đặt mô tả ngắn trong hồ sơ Bot (`/setabouttext`):**
   - Gửi `/setabouttext` -> chọn bot -> dán:
   ```text
   Điểm tin giá cà phê Tây Nguyên, thời tiết nông vụ & dự báo 6 tháng lúc 06:00 mỗi sáng.
   ```

4. **Đặt ảnh đại diện (`/setuserpic` — tùy chọn):**
   - Gửi `/setuserpic` -> chọn bot -> tải lên logo hạt cà phê hoặc biểu tượng Coffee Tracker.

5. **Đăng ký Menu Lệnh Bấm nhanh (`/setcommands`):**
   - Gửi `/setcommands` -> chọn bot -> dán chính xác 3 dòng sau (khớp `100%` với handler `/start`, `/today`, `/stop` của hệ thống):
   ```text
   start - Đăng ký nhận điểm tin giá cà phê & thời tiết 06:00 mỗi sáng
   today - Xem ngay giá cà phê, thời tiết & nhận định hôm nay
   stop - Tạm dừng nhận bản tin tự động buổi sáng
   ```

> **Tự động đồng bộ từ Backend:** Ngoài thao tác thủ công qua `@BotFather`, service `TelegramBotService` trong `apps/orchestrator` cũng tự động gọi API `setMyCommands` mỗi khi khởi động (`onModuleInit`) để bảo đảm danh sách lệnh tiếng Việt trên mọi ứng dụng Telegram luôn đồng bộ.

---

## Phần 2 — Kết nối Token vào Hệ thống `coffee-tracker`

1. Mở file `.env` tại thư mục gốc dự án và kiểm tra đủ các biến sau:
   ```env
   TELEGRAM_BOT_TOKEN=<token_lay_tu_BotFather>
   TELEGRAM_CHAT_ID=<chat_id_mac_dinh_cua_admin>
   TELEGRAM_BOT_USERNAME=minhmh_coffee_tracker_bot
   TELEGRAM_BRIEFING_CRON=0 6 * * *
   ```
   *(Mẹo lấy `TELEGRAM_CHAT_ID` nhanh: nhắn `/start` cho Bot `@userinfobot` trên Telegram để xem số ID của bạn).*

2. Áp dụng cấu hình mới bằng cách build & khởi động lại `coffee_tracker_orchestrator`:
   ```bash
   docker compose up -d --build orchestrator
   ```

3. Kiểm tra log khởi động xác nhận Bot đã kết nối và đồng bộ lệnh thành công:
   ```bash
   docker logs coffee_tracker_orchestrator --tail 40
   ```
   Kết quả kỳ vọng gồm 2 dòng:
   - `Starting Telegram Bot long-polling listener (/start, /today, /stop)...`
   - `Telegram setMyCommands succeeded (/start, /today, /stop)`

4. Xác minh trực tiếp qua API `getMyCommands` của Telegram:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMyCommands"
   ```
   Phải trả về `"ok": true` cùng 3 command `start`, `today`, `stop` bằng tiếng Việt.

---

## Phần 3 — Hướng dẫn Thao tác Thực tế cho Người dùng Cuối

1. **Mở Bot:**
   - Truy cập nhanh từ trang Web Dashboard (`http://localhost:3000`): nhấn nút **"Nhận tin Telegram"** hoặc quét mã QR ở Tầng 4 để mở thẳng `https://t.me/minhmh_coffee_tracker_bot?start=subscribe`.
2. **Bấm nút Menu (`/`):**
   - Ngay bên trái ô nhập tin nhắn trong Telegram sẽ xuất hiện nút **Menu** (biểu tượng gạch ngang / `/`). Chạm vào để thấy 3 nút bấm sẵn: `/start`, `/today`, `/stop` mà không cần gõ phím.
3. **Kiểm thử đủ 3 lệnh tương tác:**
   - **`/start`** (hoặc bấm `BẮT ĐẦU` khi mở qua deep link):
     - Bot trả lời lời chào cá nhân hóa + gửi ngay **1 bản tin mẫu đầy đủ 4 phần** (Giá cà phê, Thời tiết Tây Nguyên, Nhận định nhanh, Dự báo minh bạch 6 tháng).
     - Hệ thống lưu/cập nhật bản ghi vào bảng `telegram_subscribers` với `is_active = true`.
   - **`/today`**:
     - Bot trả ngay bản tin mới nhất tại thời điểm hiện tại trong vòng `< 3 giây`.
   - **`/stop`**:
     - Bot xác nhận tạm dừng gửi bản tin 06:00 sáng và cập nhật `is_active = false` trong `telegram_subscribers`.
4. **Kiểm tra danh sách người đăng ký trong PostgreSQL:**
   ```bash
   docker exec coffee_tracker_postgres psql -U postgres -d coffee_tracker -c "SELECT chat_id, username, first_name, is_active, subscribed_at FROM telegram_subscribers ORDER BY subscribed_at DESC;"
   ```
5. **Gửi thử bản tin 06:00 sáng thủ công từ API:**
   ```bash
   curl -X POST http://localhost:3001/api/alerts/briefing/trigger
   ```

---

## Phần 4 — Xử lý Lỗi Thường gặp (Troubleshooting)

1. **Lỗi `409 Conflict: terminated by other getUpdates request`:**
   - **Nguyên nhân:** Cùng 1 `TELEGRAM_BOT_TOKEN` đang chạy 2 tiến trình `getUpdates` song song (ví dụ: bạn vừa chạy `coffee_tracker_orchestrator` trong Docker vừa bật `pnpm start:dev` trên máy host), hoặc Bot đang bị gắn Webhook từ lần thử nghiệm cloud trước.
   - **Cách khắc phục:**
     - Dừng tiến trình Node chạy ngoài Docker (hoặc đặt `TELEGRAM_POLLING_ENABLED=false` khi chạy test/script local).
     - Nếu trước đó từng gọi `setWebhook`, xóa webhook trước khi dùng Long-Polling:
       ```bash
       curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook"
       ```
2. **Bot không phản hồi `/today` hoặc phản hồi chậm khi mới khởi động container:**
   - **Nguyên nhân:** Có thể kết nối mạng trong Docker ưu tiên IPv6 tới `api.telegram.org` gây chậm.
   - **Kiểm tra:** Bảo đảm [docker-compose.yml](file:///f:/coffee_tracker/docker-compose.yml) đang có `NODE_OPTIONS: --dns-result-order=ipv4first` cho service `orchestrator`.
3. **Bản tin báo thiếu dự báo hoặc thời tiết cũ:**
   - **Cách xử lý:** Kiểm tra xem container `coffee_tracker_ml_service` đã chạy khỏe chưa và đồng bộ lại thời tiết / chạy lại dự báo:
     ```bash
     pnpm --filter @coffee-tracker/orchestrator run sync:weather-stocks
     ```
4. **Người dùng chặn (block) Bot trong Telegram:**
   - Khi broadcast buổi sáng lúc `06:00`, Telegram trả về `403 Forbidden`. `AlertProcessor` sẽ tự động đánh dấu `is_active = false` cho `chat_id` đó trong `telegram_subscribers` để không làm gián đoạn việc gửi tin tới các người dùng khác.
