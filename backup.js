/**
 * backup.js — Sistema de backup de versoes
 * 
 * Uso:
 *   node backup.js           — Cria backup da versao atual
 *   node backup.js list     — Lista backups disponiveis
 *   node backup.js restore — Restaura ultima versao
 *   node backup.js restore <nome> — Restaura versao especifica
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
const ARQUIVOS = [
  'bot.js', 'flow.js', 'menus.js', 'orders.js', 'storage.js',
  'clientes.js', 'pix.js', 'painel.js', 'telegram.js',
  'cardapio.js', 'index.js', 'package.json', '.env'
];

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getDataHora() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function criarBackup(nome) {
  const nomeBackup = nome || `v${getDataHora()}`;
  const pastaBackup = path.join(BACKUP_DIR, nomeBackup);
  
  if (fs.existsSync(pastaBackup)) {
    console.log('! Backup ja existe! Use outro nome.');
    return;
  }
  
  fs.mkdirSync(pastaBackup, { recursive: true });
  
  let copiados = 0;
  for (const arquivo of ARQUIVOS) {
    const origem = path.join(__dirname, arquivo);
    if (fs.existsSync(origem)) {
      const destino = path.join(pastaBackup, arquivo);
      fs.copyFileSync(origem, destino);
      console.log(`+ ${arquivo}`);
      copiados++;
    }
  }
  
  console.log(`\n! Backup "${nomeBackup}" criado com ${copiados} arquivos!`);
  return nomeBackup;
}

function listarBackups() {
  const dirs = fs.readdirSync(BACKUP_DIR).filter(f => {
    return fs.statSync(path.join(BACKUP_DIR, f)).isDirectory();
  });
  
  if (dirs.length === 0) {
    console.log('! Nenhum backup encontrado.');
    return;
  }
  
  console.log('! Backups disponiveis:\n');
  dirs.sort().reverse().forEach((d, i) => {
    console.log(`${i + 1}. ${d}`);
  });
}

function restaurarBackup(nome) {
  const dirs = fs.readdirSync(BACKUP_DIR).filter(f => {
    return fs.statSync(path.join(BACKUP_DIR, f)).isDirectory();
  });
  
  dirs.sort().reverse();
  
  const backupEscolhido = nome 
    ? nome 
    : dirs[0];
  
  const pastaBackup = path.join(BACKUP_DIR, backupEscolhido);
  
  if (!fs.existsSync(pastaBackup)) {
    console.log(`! Backup "${backupEscolhido}" nao encontrado.`);
    return;
  }
  
  console.log(`! Restaurar "${backupEscolhido}"?`);
  console.log('   Isso vai sobrescrever os arquivos atuais.');
  console.log('   Tecle Enter para confirmar ou Ctrl+C para cancelar...');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('', (resposta) => {
    readline.close();
    
    let restaurados = 0;
    for (const arquivo of ARQUIVOS) {
      const origem = path.join(pastaBackup, arquivo);
      if (fs.existsSync(origem)) {
        const destino = path.join(__dirname, arquivo);
        fs.copyFileSync(origem, destino);
        console.log(`+ ${arquivo}`);
        restaurados++;
      }
    }
    
    console.log(`\n! Restaurados ${restaurados} arquivos do backup "${backupEscolhido}"!`);
  });
}

const args = process.argv.slice(2);
const comando = args[0];

if (comando === 'list') {
  listarBackups();
} else if (comando === 'restore') {
  restaurarBackup(args[1]);
} else if (!comando) {
  criarBackup();
} else {
  criarBackup(comando);
}