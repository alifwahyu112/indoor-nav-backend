const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const inputFolder = './ifc_mentah';
const outputFolder = './public/models';

// Bikin folder otomatis kalau lu lupa bikin
if (!fs.existsSync(inputFolder)) fs.mkdirSync(inputFolder);
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

fs.readdir(inputFolder, (err, files) => {
  if (err) return console.log("Gagal membaca folder ifc_mentah");
  
  // Cari semua file yang ujungnya .ifc
  const ifcFiles = files.filter(f => f.toLowerCase().endsWith('.ifc'));
  
  if(ifcFiles.length === 0) {
    return console.log("⚠️ Kosong bro! Gak ada file .ifc di folder ifc_mentah.");
  }

  console.log(`🚀 Menemukan ${ifcFiles.length} file IFC di folder. Mengecek status...`);

  ifcFiles.forEach(file => {
    const fileName = path.parse(file).name;
    
    // Otomatis ubah spasi jadi garis bawah (_)
    const safeFileName = fileName.replace(/\s+/g, '_'); 
    
    // Tentukan lokasi file
    const inputPath = `"${path.join(inputFolder, file)}"`;
    const outputPathText = path.join(outputFolder, safeFileName + '.xkt');
    const outputPathCmd = `"${outputPathText}"`;

    // 🧠 FITUR PINTAR: Cek apakah file .xkt-nya sudah ada di public/models
    if (fs.existsSync(outputPathText)) {
        console.log(`⏩ SKIP: ${safeFileName}.xkt sudah ada. (Dilewati biar cepet)`);
        return; // Hentikan proses untuk file ini, lanjut ke file berikutnya
    }

    console.log(`⏳ Sedang nge-convert: ${file} ... (Tunggu bentar)`);
    
    // Perintah eksekusi otomatis ke terminal
    exec(`npx @xeokit/xeokit-convert -s ${inputPath} -o ${outputPathCmd}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ GAGAL: ${file} ->`, error.message);
        return;
      }
      console.log(`✅ BERHASIL: ${safeFileName}.xkt siap dipakai di public/models/`);
    });
  });
});