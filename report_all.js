const { execSync } = require('child_process');

const squad = [
  { name: "Burcu (Architect)", model: "Claude Sonnet 4.6", msg: "📐 Sistem mimarisi ve DB şeması hazırlandı. Sprint 1 iskeleti kuruluyor." },
  { name: "Oğuz (Frontend)", model: "Claude Sonnet 4.6", msg: "🎨 64x64 Grid ve PixiJS entegrasyonu başlatıldı. Görsellerdeki UI kit'i port ediyorum." },
  { name: "Selin (Backend)", model: "Claude Sonnet 4.6", msg: "📡 Socket.io ve Redis Matchmaking altyapısı kuruluyor. Node.js skeleton hazır." },
  { name: "Fatih (Game Engine)", model: "Gemini 3.1 Pro", msg: "🎲 Deterministik LCG savaş motoru mantığı koda dökülüyor. Element avantajları tanımlandı." },
  { name: "İrem (QA)", model: "GPT-5.3", msg: "🧪 İlk entegrasyon test senaryoları ve dengeleme simülasyonları hazırlandı." },
  { name: "Mehmet (Designer)", model: "GPT-5.3", msg: "🖌️ Pilot Creator parçaları ve UI elementleri için asset pipeline ayarlandı." },
  { name: "Cem (Reviewer)", model: "Claude Sonnet 4.6", msg: "⚖️ İlk commitler için kod standartları ve güvenlik protokolleri belirlendi." }
];

console.log("--- SUBAGENT DURUM RAPORLARI (SPRINT 1) ---");
squad.forEach(agent => {
  console.log(`\n[${agent.name} | ${agent.model}]`);
  console.log(`> ${agent.msg}`);
});
