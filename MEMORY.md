# MEMORY.md - ROBOWAR V2 RELAUNCH

## Milestone: Sprint 1 Başlangıcı (2026-02-24)
- Tüm eski kod silindi, sıfırdan başlandı.
- Jira Sprint 1 "The Awakening" aktif — ID: 103
- 14 ticket oluşturuldu: YPY-30 → YPY-43, tümü "Devam Ediyor"
- Tüm ekip botları (Burcu, Fatih, Selin, Oğuz, İrem, Cem) gruba tanıtım mesajı gönderdi
- 4 aktif subagent çalışıyor: burcu-architect, fatih-engine, selin-backend, oguz-frontend

## Kimlik Bilgileri (jira-poller/.env)
- Jira: afternext.atlassian.net | Proje: YPY | Board: 1 | Sprint: 103
- Vercel Token: mevcut
- Telegram botları: Burcu, Selin, Oğuz, İrem, Cem, Fatih, Mehmet — hepsi ayrı token

## Sprint 1 Ticket Dağılımı
- YPY-30,31,32 → Burcu (Architect)
- YPY-33,34,35 → Fatih (Engine)
- YPY-36,37 → Selin (Backend)
- YPY-38,39,40,41 → Oğuz (Frontend)
- YPY-42 → İrem (QA)
- YPY-43 → Cem (Review)

## Sprint 2 — Bug Crusher (2026-02-24) — TAMAMLANDI
- YPY-44: Engine çakışması çözüldü (Fatih)
- YPY-45: Battle worker implement edildi + race condition fix (Selin)
- YPY-46: LCG singleton → class dönüşümü (Fatih)
- YPY-47: MetaMask auth implement edildi (Selin)
- YPY-48: JWT güvenlik hardening (Selin)
- YPY-49: P1 %100 kazanma fix — eş zamanlı hasar çözümü (Fatih)

## Simülasyon Sonuçları (36.000 savaş)
- P1 kazanma: %49.28 ✅
- P2 kazanma: %50.54 ✅
- Deterministik: DOĞRULANDI (Seed 42 her zaman aynı)
- Element avantaj çarpanı çok güçlü → YPY-50 açıldı

## Model Konfigürasyonu
- Claude Sonnet 4.6: Osman, Burcu, Selin, Oğuz, Fatih, İrem, Cem
- GPT-5.3: OpenAI API key mevcut (sk-proj-...) — sisteme eklenmeli
- Gemini: Mevcut

## Sonraki Adımlar — Sprint 3
- YPY-50: Element avantaj dengeleme (Fatih)
- GitHub repo kurulumu ve push
- Vercel deployment pipeline
- Mehmet (Designer) sprite asset entegrasyonu
