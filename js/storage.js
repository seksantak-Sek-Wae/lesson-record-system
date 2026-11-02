/**
 * storage.js - จัดการข้อมูล LocalStorage, บัญชีผู้ใช้ 3 สถานะ, คลังข้อความแนะนำอัจฉริยะ และระบบสำรองข้อมูล
 */

const STORAGE_KEYS = {
  SETTINGS: 'lesson_record_settings',
  ACCOUNTS: 'lesson_record_accounts',
  CURRENT_USER: 'lesson_record_current_user',
  RECORDS: 'lesson_record_items'
};

// ฟังก์ชันย่อและบีบอัดภาพอัจฉริยะ (รองรับทั้ง File, Blob และ Base64 String)
// แปลงภาพถ่ายเป็น JPEG เสมอเพื่อขนาดไฟล์กะทัดรัดระดับ KB ป้องกันโควตา LocalStorage เต็ม 100%
function compressImageFile(fileOrBase64, maxWidth = 420, maxHeight = 320, quality = 0.65, forceJpeg = true) {
  return new Promise((resolve) => {
    if (!fileOrBase64) return resolve(null);

    const processDataUrl = (dataUrl, originalType = 'image/jpeg') => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // ถ้าต้องการภาพ JPEG ให้ใส่พื้นหลังขาวป้องกันพื้นหลังดำจาก PNG โปร่งใส
          const outputFormat = forceJpeg ? 'image/jpeg' : (originalType === 'image/png' ? 'image/png' : 'image/jpeg');
          if (outputFormat === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL(outputFormat, quality);
          resolve(compressed);
        } catch (err) {
          console.warn('Canvas compression error:', err);
          // หาก error และไฟล์เดิมเล็กกว่า 30KB ให้นำไปใช้ได้ มิฉะนั้นคืน null เพื่อความปลอดภัย
          resolve(typeof dataUrl === 'string' && dataUrl.length < 35000 ? dataUrl : null);
        }
      };
      img.onerror = () => {
        console.warn('Could not decode image for compression');
        resolve(null);
      };
      img.src = dataUrl;
    };

    if (typeof fileOrBase64 === 'string') {
      processDataUrl(fileOrBase64);
    } else if (fileOrBase64 instanceof Blob || fileOrBase64 instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target.result, fileOrBase64.type);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(fileOrBase64);
    } else {
      resolve(null);
    }
  });
}
window.compressImageFile = compressImageFile;

// ตัวเลือกมาตรฐานสำหรับข้อมูลครูและตำแหน่ง (เพิ่มครูอัตราจ้าง และระดับชั้น)
const PROFILE_OPTIONS = {
  positions: ['ครูผู้ช่วย', 'ครู', 'ครูอัตราจ้าง', 'พนักงานราชการ'],
  ranks: [
    'ไม่มีวิทยฐานะ',
    'ครูชำนาญการ',
    'ครูชำนาญการพิเศษ',
    'ครูเชี่ยวชาญ',
    'ครูเชี่ยวชาญพิเศษ'
  ],
  roles: [
    { value: 'teacher', label: 'ครู' },
    { value: 'academic', label: 'หัวหน้ากลุ่มบริหารวิชาการ' },
    { value: 'director', label: 'ผู้อำนวยการโรงเรียน' }
  ],
  grades: [
    'ชั้นประถมศึกษาปีที่ 1',
    'ชั้นประถมศึกษาปีที่ 2',
    'ชั้นประถมศึกษาปีที่ 3',
    'ชั้นประถมศึกษาปีที่ 4',
    'ชั้นประถมศึกษาปีที่ 5',
    'ชั้นประถมศึกษาปีที่ 6',
    'ชั้นมัธยมศึกษาปีที่ 1',
    'ชั้นมัธยมศึกษาปีที่ 2',
    'ชั้นมัธยมศึกษาปีที่ 3',
    'ชั้นมัธยมศึกษาปีที่ 4',
    'ชั้นมัธยมศึกษาปีที่ 5',
    'ชั้นมัธยมศึกษาปีที่ 6'
  ],
  subjectGroups: [
    'ภาษาไทย',
    'คณิตศาสตร์',
    'วิทยาศาสตร์และเทคโนโลยี',
    'สังคมศึกษา ศาสนา และวัฒนธรรม',
    'สุขศึกษาและพลศึกษา',
    'ศิลปะ',
    'การงานอาชีพ',
    'ภาษาต่างประเทศ',
    'กิจกรรมพัฒนาผู้เรียน'
  ],
  activityHours: ['1 ชั่วโมง', '2 ชั่วโมง', '3 ชั่วโมง', '4 ชั่วโมง', '5 ชั่วโมง', '6 ชั่วโมง']
};

// บัญชีเริ่มต้นสำหรับทุกสถานะ
const DEFAULT_ACCOUNTS = [
  // 1. แอดมินหลัก (Username: 568242, Password: 568242)
  {
    id: 'acc_admin',
    username: '568242',
    password: '568242',
    role: 'admin',
    name: 'ผู้ดูแลระบบ (Admin)',
    position: 'เจ้าหน้าที่ดูแลระบบ',
    profilePhoto: null,
    createdAt: new Date().toISOString()
  },
  // 2. หัวหน้ากลุ่มบริหารงานวิชาการ
  {
    id: 'acc_academic',
    username: 'academic',
    password: 'academic',
    role: 'academic',
    name: 'นางสาวกัญญา พัฒนวิชาการ',
    position: 'ครู',
    rank: 'ครูชำนาญการพิเศษ',
    title: 'หัวหน้ากลุ่มบริหารงานวิชาการ',
    profilePhoto: null,
    signatureImg: null,
    createdAt: new Date().toISOString()
  },
  // 3. ผู้อำนวยการโรงเรียน
  {
    id: 'acc_director',
    username: 'director',
    password: 'director',
    role: 'director',
    name: 'ดร.สุรศักดิ์ ศรีวิริยะ',
    position: 'ผู้อำนวยการสถานศึกษา',
    rank: 'ผู้อำนวยการชำนาญการพิเศษ',
    title: 'ผู้อำนวยการโรงเรียน',
    profilePhoto: null,
    signatureImg: null,
    createdAt: new Date().toISOString()
  },
  // 4. บัญชีครูตัวอย่าง 1
  {
    id: 'acc_t1',
    username: 'kru1',
    password: '123',
    role: 'teacher',
    name: 'นายวีระชัย สอนดี',
    position: 'ครู',
    rank: 'ครูชำนาญการ',
    subjectGroup: 'คณิตศาสตร์',
    subjects: 'คณิตศาสตร์พื้นฐาน, คณิตศาสตร์เพิ่มเติม, เสริมทักษะคณิตศาสตร์',
    activeSubject: 'คณิตศาสตร์พื้นฐาน',
    activityHours: '1 ชั่วโมง',
    profilePhoto: null,
    signatureImg: null,
    createdAt: new Date().toISOString()
  },
  // 5. บัญชีครูตัวอย่าง 2 (ครูอัตราจ้าง)
  {
    id: 'acc_t2',
    username: 'kru2',
    password: '123',
    role: 'teacher',
    name: 'นางสาวพิมพ์ใจ ใฝ่รู้',
    position: 'ครูอัตราจ้าง',
    rank: 'ไม่มีวิทยฐานะ',
    subjectGroup: 'ภาษาไทย',
    subjects: 'ภาษาไทยพื้นฐาน, วรรณคดีวิจักษ์, การอ่านจับใจความ',
    activeSubject: 'ภาษาไทยพื้นฐาน',
    activityHours: '1 ชั่วโมง',
    profilePhoto: null,
    signatureImg: null,
    createdAt: new Date().toISOString()
  },
  // 6. บัญชีครูผู้พัฒนา (ครูเสกสรร แหวเมือง)
  {
    id: 'acc_seksan',
    username: 'seksan',
    password: '123',
    role: 'teacher',
    name: 'ครูเสกสรร แหวเมือง',
    position: 'ครู',
    rank: 'ไม่มีวิทยฐานะ',
    subjectGroup: 'วิทยาศาสตร์และเทคโนโลยี',
    subjects: 'วิทยาการคำนวณ, เทคโนโลยี (วิทยาการคำนวณ), คอมพิวเตอร์',
    activeSubject: 'วิทยาการคำนวณ',
    activityHours: '1 ชั่วโมง',
    profilePhoto: null,
    signatureImg: null,
    createdAt: new Date().toISOString()
  }
];

// การตั้งค่าเริ่มต้นของโรงเรียน
const DEFAULT_SETTINGS = {
  schoolName: 'โรงเรียนสาธิตพัฒนาการศึกษา',
  schoolAddress: 'สังกัดสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน กระทรวงศึกษาธิการ',
  logo: null,
  academicHead: 'นางสาวกัญญา พัฒนวิชาการ',
  academicHeadTitle: 'หัวหน้ากลุ่มบริหารงานวิชาการ',
  directorName: 'ดร.สุรศักดิ์ ศรีวิริยะ',
  directorTitle: 'ผู้อำนวยการโรงเรียน วิทยฐานะชำนาญการพิเศษ'
};

// บันทึกตัวอย่าง
const DEFAULT_RECORDS = [
  {
    id: 'rec_1001',
    teacherId: 'acc_t1',
    teacherUsername: 'kru1',
    teacherName: 'นายวีระชัย สอนดี',
    teacherPosition: 'ครู วิทยฐานะครูชำนาญการ',
    teacherSignature: null,
    semester: '1',
    academicYear: '2567',
    date: new Date().toISOString().split('T')[0],
    unit: '1',
    planNo: '4',
    topic: 'การบวก ลบเศษส่วนที่มีตัวส่วนไม่เท่ากัน',
    grade: 'ชั้นประถมศึกษาปีที่ 5',
    subject: 'คณิตศาสตร์พื้นฐาน',
    hours: '1 ชั่วโมง',
    activityPhoto1: null,
    activityPhoto2: null,
    knowledge: {
      totalStudents: 32,
      level1Count: 2, level1Pct: 6.25,
      level2Count: 5, level2Pct: 15.63,
      level3Count: 17, level3Pct: 53.13,
      level4Count: 8, level4Pct: 25.00
    },
    skill: 'นักเรียนสามารถแสดงวิธีทำและหาคำตอบของการบวก ลบเศษส่วนที่มีตัวส่วนไม่เท่ากันได้อย่างถูกต้องตามขั้นตอน มีทักษะในการคำนวณและเชื่อมโยงความรู้',
    attitude: 'นักเรียนมีความกระตือรือร้นและตั้งใจร่วมกิจกรรม มีวินัยและส่งงานตรงต่อเวลา',
    problem: 'นักเรียนระดับเริ่มต้น 2 คน ยังสับสนเรื่องการหาตัวคูณร่วมน้อย (ค.ร.น.) ของตัวส่วน',
    solution: 'จัดสอนซ่อมเสริมนอกเวลาโดยใช้สื่อแผนภาพเศษส่วน และให้เพื่อนคู่หูคอยช่วยแนะนำ',
    teacherSignDate: new Date().toISOString().split('T')[0],
    academicStatus: 'approved',
    academicComment: 'รับทราบผลการจัดการเรียนรู้ มีการระบุปัญหาและแนวทางแก้ไขเรื่องเศษส่วนอย่างชัดเจน กิจกรรมซ่อมเสริมมีความเหมาะสม',
    academicSignature: null,
    academicSignDate: new Date().toISOString().split('T')[0],
    directorStatus: 'approved',
    directorComment: 'ทราบและเห็นชอบตามข้อเสนอแนะ ขอชื่นชมในการเอาใจใส่นักเรียนเพื่อไม่ให้มีเด็กตกหล่นในทักษะคณิตศาสตร์',
    directorSignature: null,
    directorSignDate: new Date().toISOString().split('T')[0],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS)) {
      this.saveAccounts(DEFAULT_ACCOUNTS);
    } else {
      let accs = this.getAccounts();
      let changed = false;
      const hasAdmin = accs.some(a => a.username === '568242');
      if (!hasAdmin) {
        accs.unshift(DEFAULT_ACCOUNTS[0]);
        changed = true;
      }
      if (!accs.some(a => a.role === 'academic')) {
        accs.push(DEFAULT_ACCOUNTS[1]);
        changed = true;
      }
      if (!accs.some(a => a.role === 'director')) {
        accs.push(DEFAULT_ACCOUNTS[2]);
        changed = true;
      }
      if (!accs.some(a => a.username === 'seksan')) {
        const seksanAcc = DEFAULT_ACCOUNTS.find(a => a.username === 'seksan');
        if (seksanAcc) {
          accs.push(seksanAcc);
          changed = true;
        }
      }
      if (changed) {
        this.saveAccounts(accs);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.RECORDS)) {
      this.saveRecords(DEFAULT_RECORDS);
    }

    // รันระบบตรวจสอบและบีบอัดรูปภาพเก่าอัตโนมัติ (Self-Healing Storage Optimizer)
    setTimeout(() => this.autoOptimizeStorage(), 500);
  }

  // ระบบตรวจสอบและบีบอัดรูปภาพเก่าที่ค้างอยู่ใน LocalStorage คืนพื้นที่ว่างให้ระบบทันที
  async autoOptimizeStorage() {
    try {
      let accsChanged = false;
      const accounts = this.getAccounts();
      for (let acc of accounts) {
        if (acc.profilePhoto && acc.profilePhoto.length > 20000) {
          const comp = await window.compressImageFile(acc.profilePhoto, 180, 220, 0.70, true);
          if (comp && comp.length < acc.profilePhoto.length) {
            acc.profilePhoto = comp;
            accsChanged = true;
          }
        }
        if (acc.signatureImg && acc.signatureImg.length > 18000) {
          const comp = await window.compressImageFile(acc.signatureImg, 300, 100, 0.65, false);
          if (comp && comp.length < acc.signatureImg.length) {
            acc.signatureImg = comp;
            accsChanged = true;
          }
        }
      }
      if (accsChanged) {
        this.saveAccounts(accounts);
        const curUser = this.getCurrentUser();
        if (curUser) {
          const matched = accounts.find(a => a.id === curUser.id);
          if (matched) this.setCurrentUser(matched, true);
        }
      }

      const settings = this.getSettings();
      if (settings.logo && settings.logo.length > 25000) {
        const comp = await window.compressImageFile(settings.logo, 200, 200, 0.75, false);
        if (comp && comp.length < settings.logo.length) {
          settings.logo = comp;
          this.saveSettings(settings);
        }
      }

      let recsChanged = false;
      const records = this.getRecords();
      for (let rec of records) {
        if (rec.activityPhoto1 && rec.activityPhoto1.length > 30000) {
          const comp = await window.compressImageFile(rec.activityPhoto1, 400, 300, 0.65, true);
          if (comp && comp.length < rec.activityPhoto1.length) {
            rec.activityPhoto1 = comp;
            recsChanged = true;
          }
        }
        if (rec.activityPhoto2 && rec.activityPhoto2.length > 30000) {
          const comp = await window.compressImageFile(rec.activityPhoto2, 400, 300, 0.65, true);
          if (comp && comp.length < rec.activityPhoto2.length) {
            rec.activityPhoto2 = comp;
            recsChanged = true;
          }
        }
        // ลบสำเนา teacherProfilePhoto และ teacherSignature ใน record เพื่อประหยัดพื้นที่ (ดึงจากบัญชีครูอัตโนมัติ)
        if (rec.teacherProfilePhoto && rec.teacherProfilePhoto.length > 15000) {
          delete rec.teacherProfilePhoto;
          recsChanged = true;
        }
        if (rec.teacherSignature && rec.teacherSignature.length > 15000) {
          delete rec.teacherSignature;
          recsChanged = true;
        }
      }
      if (recsChanged) {
        this.saveRecords(records);
      }
    } catch (e) {
      console.warn('Auto storage optimization failed:', e);
    }
  }

  // --- ข้อมูลพื้นฐานโรงเรียน ---
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- บัญชีผู้ใช้ ---
  getAccounts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
    } catch (e) {
      return DEFAULT_ACCOUNTS;
    }
  }

  saveAccounts(accounts) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch (err) {
      if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
        throw new Error('หน่วยความจำ LocalStorage เต็ม ไม่สามารถบันทึกข้อมูลบัญชีได้ กรุณาลดขนาดรูปภาพ');
      }
      throw err;
    }
  }

  getTeachers() {
    return this.getAccounts().filter(a => a.role === 'teacher');
  }

  getAccountById(id) {
    return this.getAccounts().find(a => a.id === id) || null;
  }

  getAccountByUsername(username) {
    return this.getAccounts().find(a => a.username.trim() === username.trim()) || null;
  }

  // ดึงรายชื่อวิชาทั้งหมดของครู
  getTeacherSubjectList(teacher) {
    if (!teacher) return [];
    if (Array.isArray(teacher.subjectList) && teacher.subjectList.length > 0) {
      return teacher.subjectList;
    }
    if (teacher.subjects && typeof teacher.subjects === 'string') {
      const list = teacher.subjects.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length > 0) return list;
    }
    if (teacher.activeSubject) return [teacher.activeSubject];
    if (teacher.subjectGroup) return [teacher.subjectGroup];
    return ['วิชาทั่วไป'];
  }

  addTeacherSubject(teacherId, newSubjectName) {
    const trimmed = (newSubjectName || '').trim();
    if (!trimmed) return [];

    const accounts = this.getAccounts();
    const teacher = accounts.find(a => a.id === teacherId);
    if (!teacher) return [];

    const currentList = this.getTeacherSubjectList(teacher);
    if (!currentList.includes(trimmed)) {
      currentList.push(trimmed);
      teacher.subjects = currentList.join(', ');
      teacher.subjectList = currentList;
      teacher.activeSubject = trimmed;
      this.saveAccounts(accounts);

      const curUser = this.getCurrentUser();
      if (curUser && curUser.id === teacherId) {
        this.setCurrentUser(teacher);
      }
    }
    return currentList;
  }

  removeTeacherSubject(teacherId, subjectToRemove) {
    const accounts = this.getAccounts();
    const teacher = accounts.find(a => a.id === teacherId);
    if (!teacher) return [];

    let currentList = this.getTeacherSubjectList(teacher);
    currentList = currentList.filter(s => s !== subjectToRemove);
    teacher.subjects = currentList.join(', ');
    teacher.subjectList = currentList;
    if (teacher.activeSubject === subjectToRemove) {
      teacher.activeSubject = currentList[0] || '';
    }
    this.saveAccounts(accounts);

    const curUser = this.getCurrentUser();
    if (curUser && curUser.id === teacherId) {
      this.setCurrentUser(teacher);
    }
    return currentList;
  }

  // เพิ่มบัญชีผู้ใช้ใหม่ รองรับ 3 สถานะ: teacher, academic, director
  createUserAccount({ username, password, name, role = 'teacher', position, rank, subjectGroup, subjects, activeSubject, activityHours }) {
    const accounts = this.getAccounts();
    const existing = accounts.find(a => a.username.trim() === username.trim());
    if (existing) {
      throw new Error(`ชื่อผู้ใช้ (Username) "${username}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
    }

    const subList = subjects
      ? subjects.split(',').map(s => s.trim()).filter(Boolean)
      : [subjectGroup || 'ภาษาไทย'];

    let title = '';
    if (role === 'academic') title = 'หัวหน้ากลุ่มบริหารงานวิชาการ';
    if (role === 'director') title = 'ผู้อำนวยการโรงเรียน';

    const newAcc = {
      id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      username: username.trim(),
      password: password.trim(),
      role: role || 'teacher',
      name: name.trim(),
      position: position || (role === 'director' ? 'ผู้อำนวยการสถานศึกษา' : 'ครู'),
      rank: rank || 'ไม่มีวิทยฐานะ',
      title: title || (position || 'ครูผู้สอน'),
      subjectGroup: subjectGroup || 'ภาษาไทย',
      subjects: subList.join(', '),
      subjectList: subList,
      activeSubject: activeSubject || subList[0] || '',
      activityHours: activityHours || '1 ชั่วโมง',
      profilePhoto: null,
      signatureImg: null,
      createdAt: new Date().toISOString()
    };

    accounts.push(newAcc);
    this.saveAccounts(accounts);

    // หากสร้างบัญชีหัวหน้าวิชาการ หรือ ผอ. ให้อัปเดตข้อมูลพื้นฐานโรงเรียนโดยอัตโนมัติด้วย
    const settings = this.getSettings();
    if (role === 'academic') {
      settings.academicHead = name.trim();
      settings.academicHeadTitle = 'หัวหน้ากลุ่มบริหารงานวิชาการ';
      this.saveSettings(settings);
    } else if (role === 'director') {
      settings.directorName = name.trim();
      settings.directorTitle = `${position || 'ผู้อำนวยการโรงเรียน'} ${rank && rank !== 'ไม่มีวิทยฐานะ' ? rank : ''}`.trim();
      this.saveSettings(settings);
    }

    return newAcc;
  }

  updateAccount(id, updatedData) {
    const accounts = this.getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      if (updatedData.subjects && typeof updatedData.subjects === 'string') {
        updatedData.subjectList = updatedData.subjects.split(',').map(s => s.trim()).filter(Boolean);
      }
      accounts[idx] = { ...accounts[idx], ...updatedData };
      this.saveAccounts(accounts);

      const currentUser = this.getCurrentUser();
      if (currentUser && currentUser.id === id) {
        this.setCurrentUser(accounts[idx]);
      }
      return accounts[idx];
    }
    return null;
  }

  deleteAccount(id) {
    let accounts = this.getAccounts();
    const acc = accounts.find(a => a.id === id);
    if (acc && acc.username === '568242') {
      throw new Error('ไม่สามารถลบบัญชีแอดมินหลักของระบบได้');
    }
    accounts = accounts.filter(a => a.id !== id);
    this.saveAccounts(accounts);
  }

  // ดึงบัญชีผู้อำนวยการโรงเรียน
  getDirectorAccount() {
    return this.getAccounts().find(a => a.role === 'director') || null;
  }

  // ดึงบัญชีหัวหน้ากลุ่มบริหารวิชาการ
  getAcademicHeadAccount() {
    return this.getAccounts().find(a => a.role === 'academic') || null;
  }

  // บันทึก/อัปเดตบัญชีผู้อำนวยการโรงเรียนโดยเฉพาะ (แยกส่วน)
  saveDirectorAccount({ username, password, name, position, rank }) {
    let accounts = this.getAccounts();
    let director = accounts.find(a => a.role === 'director');

    // ตรวจสอบ username ซ้ำกับบัญชีอื่น
    const existing = accounts.find(a => a.username.trim() === username.trim() && a.id !== director?.id);
    if (existing) {
      throw new Error(`ชื่อผู้ใช้ (Username) "${username}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
    }

    if (director) {
      director.username = username.trim();
      if (password) director.password = password.trim();
      director.name = name.trim();
      director.position = position || 'ผู้อำนวยการโรงเรียน';
      director.rank = rank || 'ไม่มีวิทยฐานะ';
      director.title = `${position || 'ผู้อำนวยการโรงเรียน'} ${rank && rank !== 'ไม่มีวิทยฐานะ' ? rank : ''}`.trim();
    } else {
      director = {
        id: 'acc_director_' + Date.now(),
        username: username.trim(),
        password: (password || 'director').trim(),
        role: 'director',
        name: name.trim(),
        position: position || 'ผู้อำนวยการโรงเรียน',
        rank: rank || 'ไม่มีวิทยฐานะ',
        title: `${position || 'ผู้อำนวยการโรงเรียน'} ${rank && rank !== 'ไม่มีวิทยฐานะ' ? rank : ''}`.trim(),
        profilePhoto: null,
        signatureImg: null,
        createdAt: new Date().toISOString()
      };
      accounts.push(director);
    }
    this.saveAccounts(accounts);

    // ซิงค์กับข้อมูลพื้นฐานโรงเรียนอัตโนมัติ
    const settings = this.getSettings();
    settings.directorName = name.trim();
    settings.directorTitle = director.title;
    this.saveSettings(settings);

    return director;
  }

  // บันทึก/อัปเดตบัญชีหัวหน้าฝ่ายวิชาการโดยเฉพาะ (แยกส่วน)
  saveAcademicHeadAccount({ username, password, name, position, rank, subjectGroup }) {
    let accounts = this.getAccounts();
    let academic = accounts.find(a => a.role === 'academic');

    // ตรวจสอบ username ซ้ำกับบัญชีอื่น
    const existing = accounts.find(a => a.username.trim() === username.trim() && a.id !== academic?.id);
    if (existing) {
      throw new Error(`ชื่อผู้ใช้ (Username) "${username}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
    }

    if (academic) {
      academic.username = username.trim();
      if (password) academic.password = password.trim();
      academic.name = name.trim();
      academic.position = position || 'หัวหน้ากลุ่มบริหารงานวิชาการ';
      academic.rank = rank || 'ไม่มีวิทยฐานะ';
      academic.subjectGroup = subjectGroup || 'กลุ่มบริหารงานวิชาการ';
      academic.title = 'หัวหน้ากลุ่มบริหารงานวิชาการ';
    } else {
      academic = {
        id: 'acc_academic_' + Date.now(),
        username: username.trim(),
        password: (password || 'academic').trim(),
        role: 'academic',
        name: name.trim(),
        position: position || 'หัวหน้ากลุ่มบริหารงานวิชาการ',
        rank: rank || 'ไม่มีวิทยฐานะ',
        subjectGroup: subjectGroup || 'กลุ่มบริหารงานวิชาการ',
        title: 'หัวหน้ากลุ่มบริหารงานวิชาการ',
        profilePhoto: null,
        signatureImg: null,
        createdAt: new Date().toISOString()
      };
      accounts.push(academic);
    }
    this.saveAccounts(accounts);

    // ซิงค์กับข้อมูลพื้นฐานโรงเรียนอัตโนมัติ
    const settings = this.getSettings();
    settings.academicHead = name.trim();
    settings.academicHeadTitle = 'หัวหน้ากลุ่มบริหารงานวิชาการ';
    this.saveSettings(settings);

    return academic;
  }

  // ตรวจสอบว่าหัวหน้ากลุ่มบริหารวิชาการตรวจหรือยัง
  isAcademicReviewed(record) {
    if (!record) return false;
    return record.academicStatus === 'approved' || !!(record.academicSignature || record.academicSignDate);
  }

  // ตรวจสอบว่าผู้อำนวยการโรงเรียนตรวจและอนุมัติหรือยัง
  isDirectorReviewed(record) {
    if (!record) return false;
    return record.directorStatus === 'approved' || !!(record.directorSignature || record.directorSignDate);
  }

  // --- เซสชันการล็อกอิน ---
  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER) || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  setCurrentUser(user, remember = true) {
    if (!user) {
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      return;
    }
    const cleanUser = { ...user };
    sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(cleanUser));
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(cleanUser));
    }
  }

  logout() {
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  authenticate(username, password) {
    const accounts = this.getAccounts();
    const user = accounts.find(a => a.username.trim() === username.trim() && a.password.trim() === password.trim());
    return user || null;
  }

  // --- รายการบันทึกหลังสอน ---
  getRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (err) {
      if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
        console.warn('LocalStorage Quota exceeded in saveRecords. Running emergency slim recovery...');
        // ลบข้อมูลรูปภาพซ้ำซ้อนใน Records เพื่อประหยัดพื้นที่
        const slimRecords = records.map(r => {
          const copy = { ...r };
          delete copy.teacherProfilePhoto;
          delete copy.teacherSignature;
          return copy;
        });

        try {
          localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(slimRecords));
          return;
        } catch (err2) {
          // หากยังเต็ม ให้เก็บบันทึกตามปกติแต่ลดขนาดภาพของรายการก่อนหน้า
          const emergencySlim = slimRecords.map((r, idx) => {
            if (idx > 3) {
              const copy = { ...r };
              delete copy.activityPhoto1;
              delete copy.activityPhoto2;
              return copy;
            }
            return r;
          });
          try {
            localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(emergencySlim));
            return;
          } catch (err3) {
            throw new Error('หน่วยความจำ LocalStorage เต็ม ไม่สามารถบันทึกได้ กรุณาลบประวัติเก่าหรือรูปภาพ');
          }
        }
      }
      throw err;
    }
  }

  getRecordById(id) {
    return this.getRecords().find(r => r.id === id) || null;
  }

  addRecord(record) {
    const records = this.getRecords();
    const newRecord = {
      id: 'rec_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record
    };
    records.unshift(newRecord);
    this.saveRecords(records);
    return newRecord;
  }

  updateRecord(id, updatedData) {
    const records = this.getRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx !== -1) {
      records[idx] = {
        ...records[idx],
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      this.saveRecords(records);
      return records[idx];
    }
    return null;
  }

  deleteRecord(id) {
    let records = this.getRecords();
    records = records.filter(r => r.id !== id);
    this.saveRecords(records);
  }

  // --- คลังข้อความแนะนำแบบกลาง ๆ (มาตรฐานที่ใช้ได้กับทุกวิชาและทุกแผนการสอน) ---
  getGeneralSuggestions() {
    return {
      skill: 'ผู้เรียนสามารถปฏิบัติกิจกรรมตามขั้นตอนและคำแนะนำได้อย่างถูกต้อง มีทักษะกระบวนการคิดวิเคราะห์ การสื่อสาร และการทำงานร่วมกับผู้อื่นได้อย่างมีประสิทธิภาพ',
      attitude: 'ผู้เรียนมีความกระตือรือร้น ใฝ่รู้ใฝ่เรียน มีวินัย ให้ความร่วมมือในการจัดกิจกรรมการเรียนรู้ และมีความรับผิดชอบต่องานที่ได้รับมอบหมาย',
      problem: 'ผู้เรียนบางคนยังมีความพร้อมในการเรียนรู้และการทำกิจกรรมที่แตกต่างกัน ทำให้ต้องใช้เวลาในการทำความเข้าใจและปฏิบัติกิจกรรมมากกว่าเพื่อนร่วมชั้น',
      solution: 'ใช้การจัดการเรียนรู้แบบเพื่อนช่วยเพื่อน (Peer Tutoring) จัดกิจกรรมเสริมทักษะรายบุคคล และครูให้คำแนะนำช่วยเหลืออย่างใกล้ชิดเพื่อให้ผู้เรียนทุกคนบรรลุเป้าหมายการเรียนรู้',
      academicComment: 'รับทราบผลการจัดการเรียนรู้ การจัดกิจกรรมเป็นไปตามแผนการสอนและตัวชี้วัด มีการติดตามช่วยเหลือผู้เรียนอย่างเหมาะสม',
      directorComment: 'ทราบและเห็นชอบตามข้อเสนอแนะ ขอชื่นชมในความตั้งใจและการดูแลเอาใจใส่ผู้เรียนอย่างต่อเนื่อง'
    };
  }

  getGeneralPresets() {
    return {
      skill: [
        'ผู้เรียนสามารถปฏิบัติกิจกรรมตามขั้นตอนและคำแนะนำได้อย่างถูกต้อง มีทักษะกระบวนการคิดวิเคราะห์ การสื่อสาร และการทำงานร่วมกับผู้อื่นได้อย่างมีประสิทธิภาพ',
        'ผู้เรียนมีทักษะกระบวนการปฏิบัติจริง สามารถลงมือทำกิจกรรมและสรุปองค์ความรู้ได้ด้วยตนเอง',
        'ผู้เรียนสามารถนำความรู้และทักษะที่ได้รับไปประยุกต์ใช้ในการแก้ปัญหาและการทำงานได้อย่างเหมาะสม'
      ],
      attitude: [
        'ผู้เรียนมีความกระตือรือร้น ใฝ่รู้ใฝ่เรียน มีวินัย ให้ความร่วมมือในการจัดกิจกรรมการเรียนรู้ และมีความรับผิดชอบต่องานที่ได้รับมอบหมาย',
        'ผู้เรียนให้ความร่วมมือในการทำงานกลุ่ม มีน้ำใจ ช่วยเหลือซึ่งกันและกัน และส่งงานตรงต่อเวลา',
        'ผู้เรียนมีความกล้าแสดงออก มีความมั่นใจ และยอมรับฟังความคิดเห็นของผู้อื่น'
      ],
      problem: [
        'ผู้เรียนบางคนยังมีความพร้อมในการเรียนรู้และการทำกิจกรรมที่แตกต่างกัน ทำให้ต้องใช้เวลาในการทำความเข้าใจและปฏิบัติกิจกรรมมากกว่าเพื่อนร่วมชั้น',
        'ผู้เรียนบางคนยังขาดสมาธิและความมั่นใจในการทำกิจกรรมเดี่ยว ต้องได้รับการกระตุ้นและดูแลอย่างใกล้ชิด',
        'เวลาในการทำกิจกรรมและสรุปบทเรียนมีจำกัด ทำให้ผู้เรียนบางกลุ่มยังสรุปองค์ความรู้ได้ไม่สมบูรณ์เท่าที่ควร'
      ],
      solution: [
        'ใช้การจัดการเรียนรู้แบบเพื่อนช่วยเพื่อน (Peer Tutoring) จัดกิจกรรมเสริมทักษะรายบุคคล และครูให้คำแนะนำช่วยเหลืออย่างใกล้ชิดเพื่อให้ผู้เรียนทุกคนบรรลุเป้าหมายการเรียนรู้',
        'ปรับสื่อและใบงานให้กระชับ ชัดเจน พร้อมเสริมแรงทางบวกด้วยการชมเชยเพื่อสร้างความมั่นใจแก่ผู้เรียน',
        'ทบทวนและย้ำเตือนขั้นตอนสำคัญก่อนเริ่มกิจกรรม และขยายเวลาฝึกปฏิบัติเพิ่มเติม'
      ]
    };
  }

  // --- คลังข้อความแนะนำอัจฉริยะที่สอดคล้องกับ "ชื่อเรื่อง" และกลุ่มสาระ ---
  getContextualSuggestions(topic = '', subject = '') {
    const t = topic.trim().toLowerCase();
    const s = subject.trim().toLowerCase();

    // 1. หมวดภาษาไทย / การอ่าน / การเขียน / วรรณคดี
    if (t.includes('อ่าน') || t.includes('เขียน') || t.includes('คำศัพท์') || t.includes('กลอน') || t.includes('นิทาน') || s.includes('ไทย')) {
      return {
        skill: `นักเรียนสามารถอ่านออกเสียงและเขียนสะกดคำเรื่อง "${topic || 'บทเรียน'}" ได้อย่างถูกต้อง สามารถจับใจความสำคัญและสรุปประเด็นหลักได้อย่างมีลำดับขั้นตอน`,
        attitude: `นักเรียนมีนิสัยรักการอ่าน มีสมาธิในการฟังและเขียน และแสดงความกระตือรือร้นในการร่วมกิจกรรมภาษาไทย`,
        problem: `มีนักเรียนบางคนยังอ่านออกเสียงคำศัพท์ยากหรือคำควบกล้ำไม่คล่อง ทำให้จับใจความเรื่อง "${topic || 'บทเรียน'}" ได้ช้ากว่าเพื่อน`,
        solution: `จัดทำบัตรคำศัพท์เพิ่มเติม ฝึกอ่านซ้ำย้ำทวนเป็นรายบุคคล และมอบหมายเพื่อนคู่คิดช่วยประกบคู่ฝึกอ่าน`,
        academicComment: `แผนการจัดการเรียนรู้เน้นทักษะการอ่านและการคิดวิเคราะห์เรื่อง "${topic || 'บทเรียน'}" ได้ดี มีแบบฝึกเสริมทักษะที่เหมาะสม`,
        directorComment: `ทราบและเห็นชอบ ขอชื่นชมในการส่งเสริมทักษะการสื่อสารภาษาไทยแก่นักเรียนอย่างต่อเนื่อง`
      };
    }

    // 2. หมวดคณิตศาสตร์ / การคำนวณ / เศษส่วน / การแก้โจทย์
    if (t.includes('บวก') || t.includes('ลบ') || t.includes('คูณ') || t.includes('หาร') || t.includes('เศษส่วน') || t.includes('สมการ') || t.includes('โจทย์') || s.includes('คณิต')) {
      return {
        skill: `นักเรียนสามารถแสดงขั้นตอนวิธีทำและคำนวณหาคำตอบเรื่อง "${topic || 'บทเรียน'}" ได้ถูกต้องตามหลักการทางคณิตศาสตร์ มีทักษะการคิดคำนวณอย่างเป็นระบบ`,
        attitude: `นักเรียนมีความกระตือรือร้น ละเอียดรอบคอบในการตรวจทานคำตอบ และมีความมั่นใจในการแก้โจทย์ปัญหา`,
        problem: `นักเรียนบางคนยังสับสนลำดับขั้นตอนในการคิดคำนวณเรื่อง "${topic || 'บทเรียน'}" ทำให้คำตอบคลาดเคลื่อน`,
        solution: `ใช้สื่อรูปธรรมและแผนภาพจำลองช่วยอธิบายขั้นตอน พร้อมจัดกิจกรรมเพื่อนช่วยเพื่อนและให้ทำแบบฝึกทบทวนย่อย`,
        academicComment: `การจัดกิจกรรมการเรียนรู้เปิดโอกาสให้นักเรียนได้ฝึกปฏิบัติจริงเรื่อง "${topic || 'บทเรียน'}" สื่อการสอนมีความชัดเจนเข้าใจง่าย`,
        directorComment: `รับทราบ ชื่นชมการจัดกิจกรรมคณิตศาสตร์ที่เน้นความเข้าใจมากกว่าการท่องจำ เห็นควรพัฒนาทักษะนี้อย่างต่อเนื่อง`
      };
    }

    // 3. หมวดวิทยาศาสตร์ / การทดลอง / สิ่งมีชีวิต / พลังงาน / สะเต็ม
    if (t.includes('ทดลอง') || t.includes('สังเกต') || t.includes('พลังงาน') || t.includes('พืช') || t.includes('สัตว์') || t.includes('ระบบ') || s.includes('วิทย์') || s.includes('เทคโนโลยี')) {
      return {
        skill: `นักเรียนมีทักษะกระบวนการทางวิทยาศาสตร์ในการสังเกต ตั้งสมมติฐาน ทดลอง และสรุปผลเรื่อง "${topic || 'บทเรียน'}" ได้อย่างถูกต้องตามระเบียบวิธี`,
        attitude: `นักเรียนมีความอยากรู้อยากเห็น ช่างซักถาม ทำงานร่วมกับผู้อื่นได้อย่างมีประสิทธิภาพ และมีความรับผิดชอบต่ออุปกรณ์การทดลอง`,
        problem: `นักเรียนบางกลุ่มใช้เวลาในการบันทึกผลการทดลองเรื่อง "${topic || 'บทเรียน'}" นาน ทำให้สรุปผลได้ไม่ทันเวลา`,
        solution: `เตรียมใบสรุปผลการทดลองที่มีโครงร่างชัดเจน และกระตุ้นการแบ่งหน้าที่รับผิดชอบภายในกลุ่มให้ชัดเจนขึ้น`,
        academicComment: `กิจกรรมเน้นการลงมือปฏิบัติ (Hands-on) เรื่อง "${topic || 'บทเรียน'}" ได้อย่างมีประสิทธิภาพ สอดคล้องกับตัวชี้วัดวิทยาศาสตร์`,
        directorComment: `รับทราบ การฝึกกระบวนการคิดแบบวิทยาศาสตร์ช่วยให้ผู้เรียนเกิดทักษะชีวิตที่ดี ขอให้รักษามาตรฐานนี้ไว้`
      };
    }

    // 4. หมวดภาษาต่างประเทศ / ภาษาอังกฤษ
    if (t.includes('english') || t.includes('conversation') || t.includes('grammar') || t.includes('สนทนา') || s.includes('อังกฤษ') || s.includes('ต่างประเทศ')) {
      return {
        skill: `นักเรียนสามารถออกเสียงคำศัพท์และใช้ประโยคสื่อสารเรื่อง "${topic || 'บทเรียน'}" ได้ถูกต้องตามหลักไวยากรณ์และบริบทการสื่อสาร`,
        attitude: `นักเรียนมีความกล้าแสดงออก มั่นใจในการพูดภาษาต่างประเทศ และร่วมกิจกรรมเกมทางภาษาอย่างสนุกสนาน`,
        problem: `นักเรียนบางคนยังไม่กล้าออกเสียงคำศัพท์ภาษาอังกฤษต่อหน้าชั้นเรียนเนื่องจากขาดความมั่นใจ`,
        solution: `จัดกิจกรรมการพูดเป็นคู่ (Pair work) ร้องเพลงภาษาอังกฤษ และให้คำชมเชยเพื่อสร้างเสริมความมั่นใจ`,
        academicComment: `กิจกรรมส่งเสริมทักษะการฟัง-พูดเรื่อง "${topic || 'บทเรียน'}" ได้อย่างเป็นธรรมชาติ สื่อการสอนทันสมัย`,
        directorComment: `ทราบและเห็นชอบ ขอสนับสนุนการจัดการเรียนรู้ภาษาต่างประเทศที่มุ่งเน้นการใช้งานจริงในชีวิตประจำวัน`
      };
    }

    // 5. หมวดสังคมศึกษา / ประวัติศาสตร์ / หน้าที่พลเมือง
    if (t.includes('ประวัติ') || t.includes('ศาสนา') || t.includes('ภูมิศาสตร์') || t.includes('พลเมือง') || s.includes('สังคม')) {
      return {
        skill: `นักเรียนสามารถวิเคราะห์เหตุการณ์และอธิบายความสำคัญของเรื่อง "${topic || 'บทเรียน'}" พร้อมทั้งสังเคราะห์ข้อคิดไปประยุกต์ใช้ในสังคมได้`,
        attitude: `นักเรียนมีความตระหนักรู้ ภาคภูมิใจในความเป็นไทย มีจิตสาธารณะ และยอมรับความคิดเห็นที่แตกต่าง`,
        problem: `นักเรียนบางส่วนจำลำดับเหตุการณ์หรือรายละเอียดเรื่อง "${topic || 'บทเรียน'}" ได้ไม่ครบถ้วน`,
        solution: `ใช้สื่อไทม์ไลน์ภาพประกอบและแผนผังความคิด (Mind Mapping) ช่วยสรุปเชื่อมโยงประเด็นสำคัญ`,
        academicComment: `การจัดการเรียนรู้ช่วยพัฒนาคุณลักษณะพลเมืองที่ดีและกระตุ้นการคิดเชื่อมโยงเรื่อง "${topic || 'บทเรียน'}" ได้อย่างเหมาะสม`,
        directorComment: `รับทราบ การเรียนรู้สังคมและประวัติศาสตร์มีคุณค่าอย่างยิ่งในการปลูกฝังคุณธรรม ขอชื่นชม`
      };
    }

    // 6. หมวดคอมพิวเตอร์ / ศิลปะ / การงาน / พลศึกษา หรือเรื่องทั่วไป
    return {
      skill: `นักเรียนสามารถปฏิบัติกิจกรรมและแสดงขั้นตอนการแก้ปัญหาเรื่อง "${topic || 'บทเรียน'}" ได้อย่างถูกต้องตามลำดับขั้นตอน มีทักษะการคิดวิเคราะห์และการทำงานเป็นทีม`,
      attitude: `นักเรียนมีความกระตือรือร้น ใฝ่รู้ใฝ่เรียน ให้ความร่วมมือในการทำกิจกรรม และส่งงานตรงต่อเวลาที่กำหนด`,
      problem: `นักเรียนบางคนยังเข้าใจเนื้อหาเรื่อง "${topic || 'บทเรียน'}" ช้ากว่าเพื่อนร่วมชั้นเนื่องจากพื้นฐานเดิมต่างกัน`,
      solution: `จัดกิจกรรมเสริมทักษะแบบเพื่อนช่วยเพื่อน (Peer Tutoring) และใช้สื่อการสอนที่หลากหลายเพื่อตอบสนองการเรียนรู้รายบุคคล`,
      academicComment: `รับทราบผลการจัดการเรียนรู้เรื่อง "${topic || 'บทเรียน'}" มีการวัดและประเมินผลที่สอดคล้องกับตัวชี้วัดและแผนการสอน`,
      directorComment: `ทราบและเห็นชอบตามแนวทางแก้ไข ขอชื่นชมในความตั้งใจและการติดตามช่วยเหลือนักเรียนอย่างใกล้ชิด`
    };
  }

  // --- สำรอง / นำเข้าข้อมูล ---
  exportBackupJSON() {
    const backup = {
      app: 'LessonRecordSystem',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      accounts: this.getAccounts(),
      records: this.getRecords()
    };
    return JSON.stringify(backup, null, 2);
  }

  importBackupJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || (!parsed.settings && !parsed.records)) {
        throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง');
      }
      if (parsed.settings) this.saveSettings(parsed.settings);
      if (parsed.accounts && Array.isArray(parsed.accounts)) this.saveAccounts(parsed.accounts);
      if (parsed.records && Array.isArray(parsed.records)) this.saveRecords(parsed.records);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

window.PROFILE_OPTIONS = PROFILE_OPTIONS;
window.storageMgr = new StorageManager();
