/**
 * app.js - ตัวควบคุมหลักของระบบ การล็อกอิน 3 สถานะ ข้อมูลส่วนตัวและรูปถ่ายครู
 */

class App {
  constructor() {
    this.currentTab = 'tab-dashboard';
    this.activeReviewRecordId = null;
    this.activeReviewRole = null;
    this.currentReviewSigBase64 = null;
    this.currentAdminSubtab = 'teachers';
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.setupAuthEvents();
      this.setupNavigation();
      this.setupSettingsEvents();
      this.setupTeacherProfileEvents();
      this.setupReviewModalEvents();
      this.setupAdminAccountEvents();

      // ตรวจสอบสถานะการล็อกอิน
      this.checkAuthStatus();
    });
  }

  // --- 1. ระบบยืนยันตัวตนและการล็อกอิน (Authentication) ---
  setupAuthEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        let user = window.storageMgr.authenticate(username, password);

        // กรณีล็อกอินจากอุปกรณ์ใหม่/มือถือ/ไอแพดครั้งแรก หากยังไม่เจอในเครื่อง ให้ดึงบัญชีล่าสุดจาก Cloud ทันที
        if (!user && window.firebaseDb) {
          try {
            const snap = await window.firebaseDb.ref('accounts').once('value');
            const val = snap.val();
            if (val) {
              const accs = Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean);
              localStorage.setItem('lesson_records_accounts', JSON.stringify(accs));
              user = accs.find(a => a.username.trim() === username && a.password.trim() === password);
            }
          } catch (err) {
            console.warn('Firebase login sync check error:', err);
          }
        }

        if (user) {
          window.storageMgr.setCurrentUser(user);
          this.closeLoginModal();
          this.applyUserRoleUI(user);
          if (window.visitorTracker) {
            window.visitorTracker.updateActiveSession();
            window.visitorTracker.renderStats();
          }
          this.showToast(`ยินดีต้อนรับคุณ ${user.name}`, 'success');
          // ตรวจสอบแจ้งเตือนหากครูขาดส่ง >= 5 วัน
          this.checkTeacherSubmissionLagAlert(user, true);
        } else {
          this.showToast('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (สำหรับแอดมิน: 568242)', 'error');
        }
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
          window.storageMgr.logout();
          if (window.visitorTracker) {
            window.visitorTracker.updateActiveSession();
            window.visitorTracker.renderStats();
          }
          this.showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
          setTimeout(() => location.reload(), 300);
        }
      });
    }
  }

  checkAuthStatus() {
    const currentUser = window.storageMgr.getCurrentUser();
    if (!currentUser) {
      this.showLoginModal();
    } else {
      this.closeLoginModal();
      this.applyUserRoleUI(currentUser);
      this.checkTeacherSubmissionLagAlert(currentUser, false);
    }
    if (window.visitorTracker) {
      window.visitorTracker.updateActiveSession();
      window.visitorTracker.renderStats();
    }
  }

  showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('hidden');
  }

  // กำหนดสิทธิ์การมองเห็นเมนูและอัปเดต Header ตามบทบาท
  applyUserRoleUI(user) {
    if (!user) return;
    const userNameEl = document.getElementById('current-user-name');
    const userRoleEl = document.getElementById('current-user-role');
    const userAvatarEl = document.getElementById('current-user-avatar');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userRoleEl) {
      const roleMap = {
        admin: { text: 'ผู้ดูแลระบบ (Admin)', class: 'bg-red-100 text-red-700' },
        teacher: { text: user.position || 'ครูผู้สอน', class: 'bg-blue-100 text-blue-700' },
        academic: { text: 'หัวหน้ากลุ่มบริหารวิชาการ', class: 'bg-purple-100 text-purple-700' },
        director: { text: 'ผู้อำนวยการโรงเรียน', class: 'bg-emerald-100 text-emerald-700' }
      };
      const info = roleMap[user.role] || { text: user.role, class: 'bg-slate-100 text-slate-700' };
      userRoleEl.textContent = info.text;
      userRoleEl.className = `px-2.5 py-0.5 rounded-full text-xs font-semibold ${info.class}`;
    }

    // แสดงรูปถ่ายใบหน้าใน Header
    if (userAvatarEl) {
      if (user.profilePhoto) {
        userAvatarEl.innerHTML = `<img src="${user.profilePhoto}" alt="Avatar" class="w-9 h-9 rounded-full object-cover border-2 border-blue-500 shadow-sm" />`;
      } else {
        const iconMap = { admin: '👑', academic: '📚', director: '🏫', teacher: '👨‍🏫' };
        userAvatarEl.innerHTML = `<div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-lg border border-slate-200">${iconMap[user.role] || '👤'}</div>`;
      }
    }

    // แสดง/ซ่อน เมนูตาม Role
    document.querySelectorAll('[data-role-perm]').forEach(el => {
      const allowedRoles = el.getAttribute('data-role-perm').split(',');
      if (allowedRoles.includes(user.role)) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // แสดง/ซ่อน ปุ่มติดตามความถี่การส่งบันทึกของครู (เฉพาะ ฝ่ายวิชาการ, ผู้อำนวยการ, และแอดมิน)
    const canViewFreq = ['academic', 'director', 'admin'].includes(user.role);
    const btnFreqHistory = document.getElementById('btn-open-frequency-modal');
    const btnFreqDash = document.getElementById('btn-open-frequency-modal-dash');
    if (btnFreqHistory) {
      if (canViewFreq) btnFreqHistory.classList.remove('hidden');
      else btnFreqHistory.classList.add('hidden');
    }
    if (btnFreqDash) {
      if (canViewFreq) btnFreqDash.classList.remove('hidden');
      else btnFreqDash.classList.add('hidden');
    }

    this.loadSettingsToUI();
    this.populateProfileDropdowns();
    if (user.role === 'teacher') {
      this.loadTeacherProfileToUI(user);
    }
    if (user.role === 'admin') {
      this.renderAccountsTable();
    }

    window.formMgr.populateTeacherDropdown();
    window.dashboardMgr.render();
    window.dashboardMgr.updateFilterDropdowns();
    window.printMgr.init();

    this.switchTab('tab-dashboard');
  }

  // --- 2. การสลับแท็บ (Navigation) ---
  setupNavigation() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));

    const activeTab = document.getElementById(tabId);
    if (activeTab) {
      activeTab.classList.remove('hidden');
      activeTab.classList.add('animate-fade-in');
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      if (isTarget) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    const currentUser = window.storageMgr.getCurrentUser();

    if (tabId === 'tab-dashboard') {
      window.dashboardMgr.render();
      window.dashboardMgr.updateFilterDropdowns();
    } else if (tabId === 'tab-history') {
      window.dashboardMgr.updateFilterDropdowns();
      window.dashboardMgr.renderHistoryTable();
    } else if (tabId === 'tab-form') {
      window.formMgr.populateTeacherDropdown();
      window.formMgr.autoFillFromCurrentUser();
    } else if (tabId === 'tab-profile' && currentUser?.role === 'teacher') {
      this.loadTeacherProfileToUI(currentUser);
    } else if (tabId === 'tab-admin-accounts' && currentUser?.role === 'admin') {
      this.renderAccountsTable();
    } else if (tabId === 'tab-settings' && currentUser?.role === 'admin') {
      this.loadSettingsToUI();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- 3. ข้อมูลส่วนตัวของครู (Teacher Profile) ---
  populateProfileDropdowns() {
    const opts = window.PROFILE_OPTIONS;

    // ตำแหน่ง (มีครูอัตราจ้าง)
    const posSelect = document.getElementById('profile-position');
    if (posSelect && !posSelect.children.length) {
      opts.positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        posSelect.appendChild(opt);
      });
    }

    // วิทยฐานะ
    const rankSelect = document.getElementById('profile-rank');
    if (rankSelect && !rankSelect.children.length) {
      opts.ranks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        rankSelect.appendChild(opt);
      });
    }

    // กลุ่มสาระการเรียนรู้
    const grpSelect = document.getElementById('profile-subject-group');
    if (grpSelect && !grpSelect.children.length) {
      opts.subjectGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        grpSelect.appendChild(opt);
      });
    }

    // ชั่วโมง
    const hourSelect = document.getElementById('profile-hours');
    if (hourSelect && !hourSelect.children.length) {
      opts.activityHours.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h; opt.textContent = h;
        hourSelect.appendChild(opt);
      });
    }

    // สำหรับแอดมินสร้างบัญชีใหม่ (เลือกสิทธิ์ ครู, วิชาการ, ผอ.)
    const adminRoleSelect = document.getElementById('new-acc-role');
    if (adminRoleSelect && !adminRoleSelect.children.length) {
      opts.roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.value; opt.textContent = r.label;
        adminRoleSelect.appendChild(opt);
      });
    }

    const adminPos = document.getElementById('new-acc-position');
    if (adminPos && !adminPos.children.length) {
      opts.positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        adminPos.appendChild(opt);
      });
    }

    const adminRank = document.getElementById('new-acc-rank');
    if (adminRank && !adminRank.children.length) {
      opts.ranks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        adminRank.appendChild(opt);
      });
    }

    const adminGrp = document.getElementById('new-acc-group');
    if (adminGrp && !adminGrp.children.length) {
      opts.subjectGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        adminGrp.appendChild(opt);
      });
    }

    // Dropdowns สำหรับฟอร์มหัวหน้าวิชาการ
    const acadPos = document.getElementById('academic-acc-position');
    if (acadPos && !acadPos.children.length) {
      ['หัวหน้ากลุ่มบริหารงานวิชาการ', 'ครู', 'ครูชำนาญการ', 'ครูชำนาญการพิเศษ'].forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        acadPos.appendChild(opt);
      });
    }

    const acadRank = document.getElementById('academic-acc-rank');
    if (acadRank && !acadRank.children.length) {
      opts.ranks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        acadRank.appendChild(opt);
      });
    }

    // Dropdowns สำหรับฟอร์มผู้อำนวยการโรงเรียน
    const dirRank = document.getElementById('director-acc-rank');
    if (dirRank && !dirRank.children.length) {
      ['ผู้อำนวยการชำนาญการ', 'ผู้อำนวยการชำนาญการพิเศษ', 'ผู้อำนวยการเชี่ยวชาญ', 'ผู้อำนวยการเชี่ยวชาญพิเศษ', 'ไม่มีวิทยฐานะ'].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        dirRank.appendChild(opt);
      });
    }

    // Dropdowns สำหรับ Modal แก้ไขข้อมูลครูผู้สอนโดย Admin
    const editPos = document.getElementById('edit-teacher-position');
    if (editPos && !editPos.children.length) {
      opts.positions.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p;
        editPos.appendChild(opt);
      });
    }

    const editRank = document.getElementById('edit-teacher-rank');
    if (editRank && !editRank.children.length) {
      opts.ranks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        editRank.appendChild(opt);
      });
    }

    const editGrp = document.getElementById('edit-teacher-group');
    if (editGrp && !editGrp.children.length) {
      opts.subjectGroups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        editGrp.appendChild(opt);
      });
    }
  }

  renderTeacherSubjectBadges(user) {
    const container = document.getElementById('profile-subjects-badges');
    if (!container) return;

    const subjects = window.storageMgr.getTeacherSubjectList(user);
    if (!subjects.length) {
      container.innerHTML = `<span class="text-xs text-slate-400">ยังไม่มีรายวิชาที่สอน กรุณากดเพิ่มวิชา</span>`;
      return;
    }

    container.innerHTML = subjects.map(sub => `
      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <span>📖 ${sub}</span>
        <button type="button" onclick="window.app.removeSubjectFromProfile('${sub}')" class="ml-1.5 text-blue-400 hover:text-red-500 font-bold" title="ลบวิชานี้">✕</button>
      </span>
    `).join('');

    const activeSubSelect = document.getElementById('profile-active-subject');
    if (activeSubSelect) {
      activeSubSelect.innerHTML = '';
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === user.activeSubject) opt.selected = true;
        activeSubSelect.appendChild(opt);
      });
    }
  }

  removeSubjectFromProfile(subjectName) {
    const user = window.storageMgr.getCurrentUser();
    if (!user) return;
    if (confirm(`คุณต้องการลบวิชา "${subjectName}" ออกจากรายการที่สอนใช่หรือไม่?`)) {
      window.storageMgr.removeTeacherSubject(user.id, subjectName);
      const updatedUser = window.storageMgr.getCurrentUser();
      this.loadTeacherProfileToUI(updatedUser);
      this.showToast(`ลบวิชา "${subjectName}" แล้ว`, 'info');
    }
  }

  loadTeacherProfileToUI(user) {
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-position').value = user.position || 'ครู';
    document.getElementById('profile-rank').value = user.rank || 'ไม่มีวิทยฐานะ';
    document.getElementById('profile-subject-group').value = user.subjectGroup || 'ภาษาไทย';
    document.getElementById('profile-hours').value = user.activityHours || '1 ชั่วโมง';

    this.renderTeacherSubjectBadges(user);

    // รูปถ่ายใบหน้าครู
    const avatarImg = document.getElementById('preview-teacher-avatar');
    const avatarPlaceholder = document.getElementById('placeholder-teacher-avatar');
    const btnRemoveAvatar = document.getElementById('btn-remove-teacher-avatar');

    if (user.profilePhoto) {
      if (avatarImg) { avatarImg.src = user.profilePhoto; avatarImg.classList.remove('hidden'); }
      if (avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
      if (btnRemoveAvatar) btnRemoveAvatar.classList.remove('hidden');
    } else {
      if (avatarImg) { avatarImg.src = ''; avatarImg.classList.add('hidden'); }
      if (avatarPlaceholder) avatarPlaceholder.classList.remove('hidden');
      if (btnRemoveAvatar) btnRemoveAvatar.classList.add('hidden');
    }

    // ลายเซ็นครู
    const sigImg = document.getElementById('preview-teacher-sig');
    const btnRemoveTeacherSig = document.getElementById('btn-remove-teacher-sig');
    if (sigImg) {
      if (user.signatureImg) {
        sigImg.src = user.signatureImg;
        sigImg.classList.remove('hidden');
        if (btnRemoveTeacherSig) btnRemoveTeacherSig.classList.remove('hidden');
      } else {
        sigImg.src = '';
        sigImg.classList.add('hidden');
        if (btnRemoveTeacherSig) btnRemoveTeacherSig.classList.add('hidden');
      }
    }
  }

  setupTeacherProfileEvents() {
    const profileForm = document.getElementById('teacher-profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = window.storageMgr.getCurrentUser();
        if (!user) return;

        const updatedData = {
          name: document.getElementById('profile-name').value.trim(),
          position: document.getElementById('profile-position').value,
          rank: document.getElementById('profile-rank').value,
          subjectGroup: document.getElementById('profile-subject-group').value,
          activeSubject: document.getElementById('profile-active-subject')?.value || '',
          activityHours: document.getElementById('profile-hours').value
        };

        const newPassword = document.getElementById('profile-new-password')?.value.trim();
        if (newPassword) {
          updatedData.password = newPassword;
        }

        window.storageMgr.updateAccount(user.id, updatedData);
        this.applyUserRoleUI(window.storageMgr.getCurrentUser());
        if (window.visitorTracker) {
          window.visitorTracker.updateActiveSession();
          window.visitorTracker.renderStats();
        }
        this.showToast('บันทึกข้อมูลส่วนตัวของครูเรียบร้อยแล้ว', 'success');
      });
    }

    // อัปโหลดรูปถ่ายใบหน้าของครูผู้สอน
    const inputAvatar = document.getElementById('input-teacher-avatar-file');
    if (inputAvatar) {
      inputAvatar.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // รองรับภาพถ่ายทุกชนิด รวมทั้งภาพจากสมาร์ตโฟน (.jpg, .jpeg, .png, .webp, .jfif, .heic, .avif ฯลฯ)
        const isImage = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|jfif|heic|avif)$/i.test(file.name);
        if (!isImage) {
          this.showToast('กรุณาเลือกไฟล์รูปภาพ (.jpg, .png, .webp ฯลฯ)', 'error');
          return;
        }

        try {
          // บีบอัดรูปถ่ายหน้าครูให้อยู่ในขนาด 180x220 px คุณภาพ 0.70 JPEG ขนาดเหลือเพียง ~6-8 KB
          const base64 = await window.compressImageFile(file, 180, 220, 0.70, true);
          if (!base64) {
            this.showToast('ไม่สามารถประมวลผลรูปภาพนี้ได้ กรุณาลองใช้รูปภาพอื่น', 'error');
            return;
          }

          const user = window.storageMgr.getCurrentUser();
          window.storageMgr.updateAccount(user.id, { profilePhoto: base64 });
          this.loadTeacherProfileToUI(window.storageMgr.getCurrentUser());
          this.applyUserRoleUI(window.storageMgr.getCurrentUser());
          this.showToast('อัปเดตรูปถ่ายใบหน้าครูผู้สอนเรียบร้อยแล้ว', 'success');
        } catch (err) {
          console.error(err);
          this.showToast(`บันทึกรูปถ่ายไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
    }

    // ลบรูปถ่ายใบหน้าครู
    const btnRemoveAvatar = document.getElementById('btn-remove-teacher-avatar');
    if (btnRemoveAvatar) {
      btnRemoveAvatar.addEventListener('click', () => {
        if (confirm('คุณต้องการลบรูปถ่ายใบหน้าใช่หรือไม่?')) {
          const user = window.storageMgr.getCurrentUser();
          window.storageMgr.updateAccount(user.id, { profilePhoto: null });
          this.loadTeacherProfileToUI(window.storageMgr.getCurrentUser());
          this.applyUserRoleUI(window.storageMgr.getCurrentUser());
          this.showToast('ลบรูปถ่ายใบหน้าเรียบร้อยแล้ว', 'info');
        }
      });
    }

    // ปุ่มเพิ่มวิชาใหม่ในหน้า Profile
    const btnAddProfileSubject = document.getElementById('btn-profile-add-subject');
    const inputNewSubject = document.getElementById('profile-new-subject-input');
    if (btnAddProfileSubject && inputNewSubject) {
      btnAddProfileSubject.addEventListener('click', () => {
        const subName = inputNewSubject.value.trim();
        if (!subName) {
          this.showToast('กรุณากรอกชื่อวิชาที่ต้องการเพิ่ม', 'warning');
          return;
        }
        const user = window.storageMgr.getCurrentUser();
        if (user) {
          window.storageMgr.addTeacherSubject(user.id, subName);
          inputNewSubject.value = '';
          const updatedUser = window.storageMgr.getCurrentUser();
          this.loadTeacherProfileToUI(updatedUser);
          this.showToast(`เพิ่มวิชา "${subName}" เรียบร้อยแล้ว`, 'success');
        }
      });
    }

    // อัปโหลดรูปลายเซ็นของครู
    const inputSig = document.getElementById('input-teacher-sig-file');
    if (inputSig) {
      inputSig.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const base64 = await window.compressImageFile(file, 300, 100, 0.65, false);
          if (!base64) {
            this.showToast('ไม่สามารถอ่านไฟล์ลายเซ็นได้', 'error');
            return;
          }

          const user = window.storageMgr.getCurrentUser();
          window.storageMgr.updateAccount(user.id, { signatureImg: base64 });
          const sigImg = document.getElementById('preview-teacher-sig');
          const btnRemoveSig = document.getElementById('btn-remove-teacher-sig');
          if (sigImg) {
            sigImg.src = base64;
            sigImg.classList.remove('hidden');
          }
          if (btnRemoveSig) btnRemoveSig.classList.remove('hidden');
          this.showToast('อัปโหลดลายมือชื่อของครูเรียบร้อยแล้ว', 'success');
        } catch (err) {
          this.showToast(`บันทึกลายเซ็นไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
    }

    // ลบลายมือชื่อครู
    const btnRemoveSig = document.getElementById('btn-remove-teacher-sig');
    if (btnRemoveSig) {
      btnRemoveSig.addEventListener('click', () => {
        if (confirm('คุณต้องการลบลายมือชื่อใช่หรือไม่?')) {
          const user = window.storageMgr.getCurrentUser();
          if (user) {
            window.storageMgr.updateAccount(user.id, { signatureImg: null });
            const sigImg = document.getElementById('preview-teacher-sig');
            if (sigImg) {
              sigImg.src = '';
              sigImg.classList.add('hidden');
            }
            btnRemoveSig.classList.add('hidden');
            const inputSig = document.getElementById('input-teacher-sig-file');
            if (inputSig) inputSig.value = '';
            this.showToast('ลบลายมือชื่อเรียบร้อยแล้ว', 'info');
          }
        }
      });
    }
  }

  // --- 4. ระบบตรวจและลงนามของหัวหน้าวิชาการ & ผอ. ---
  setupReviewModalEvents() {
    const reviewForm = document.getElementById('form-review-modal');
    if (reviewForm) {
      reviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.activeReviewRecordId) return;

        const record = window.storageMgr.getRecordById(this.activeReviewRecordId);
        if (!record) return;

        const role = this.activeReviewRole;

        // ตรวจสอบลำดับการตรวจ: ผอ. ตรวจได้เมื่อผ่านวิชาการแล้วเท่านั้น
        if (role === 'director' && !window.storageMgr.isAcademicReviewed(record)) {
          this.showToast('ไม่สามารถตรวจได้: ต้องผ่านการตรวจและลงนามของหัวหน้ากลุ่มบริหารวิชาการก่อน', 'error');
          return;
        }

        const comment = document.getElementById('review-modal-comment').value.trim();
        const signDate = document.getElementById('review-modal-signdate').value;
        const currentUser = window.storageMgr.getCurrentUser();
        const stampCheckbox = document.getElementById('review-modal-stamp-sig');
        const shouldStamp = stampCheckbox ? stampCheckbox.checked : Boolean(this.currentReviewSigBase64);
        const finalSig = (shouldStamp && this.currentReviewSigBase64) ? this.currentReviewSigBase64 : '';

        const updateObj = {};
        if (role === 'academic') {
          updateObj.academicStatus = 'approved';
          updateObj.academicComment = comment;
          updateObj.academicSignDate = signDate;
          updateObj.academicSignature = finalSig; // บันทึกเป็น '' เมื่อลบออก จะไม่แสดงใน A4 เด็ดขาด
          updateObj.showAcademicSig = Boolean(finalSig);
          updateObj.academicReviewedAt = new Date().toISOString();
          if (finalSig && currentUser && currentUser.role === 'academic') {
            window.storageMgr.updateAccount(currentUser.id, { signatureImg: finalSig });
          }
        } else if (role === 'director') {
          updateObj.directorStatus = 'approved';
          updateObj.directorComment = comment;
          updateObj.directorSignDate = signDate;
          updateObj.directorSignature = finalSig; // บันทึกเป็น '' เมื่อลบออก จะไม่แสดงใน A4 เด็ดขาด
          updateObj.showDirectorSig = Boolean(finalSig);
          updateObj.directorReviewedAt = new Date().toISOString();
          if (finalSig && currentUser && currentUser.role === 'director') {
            window.storageMgr.updateAccount(currentUser.id, { signatureImg: finalSig });
          }
        }

        try {
          window.storageMgr.updateRecord(record.id, updateObj);
          this.closeReviewModal();
          window.dashboardMgr.render();
          window.dashboardMgr.renderHistoryTable();
          this.showToast('บันทึกการตรวจและลงนามเรียบร้อยแล้ว!', 'success');
        } catch (err) {
          this.showToast(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, 'error');
        }
      });
    }

    const modalSigFile = document.getElementById('review-modal-sigfile');
    if (modalSigFile) {
      modalSigFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          const base64 = await window.compressImageFile(file, 300, 100, 0.65, false);
          if (base64) {
            this.currentReviewSigBase64 = base64;
            const preview = document.getElementById('preview-review-sig');
            const btnDelete = document.getElementById('btn-delete-review-sig');
            const stampCheckbox = document.getElementById('review-modal-stamp-sig');
            if (preview) {
              preview.src = base64;
              preview.classList.remove('hidden');
            }
            if (btnDelete) btnDelete.classList.remove('hidden');
            if (stampCheckbox) stampCheckbox.checked = true;
          }
        }
      });
    }

    const btnDeleteReviewSig = document.getElementById('btn-delete-review-sig');
    if (btnDeleteReviewSig) {
      btnDeleteReviewSig.addEventListener('click', () => {
        this.currentReviewSigBase64 = '';
        const preview = document.getElementById('preview-review-sig');
        if (preview) {
          preview.src = '';
          preview.classList.add('hidden');
        }
        btnDeleteReviewSig.classList.add('hidden');
        const stampCheckbox = document.getElementById('review-modal-stamp-sig');
        if (stampCheckbox) stampCheckbox.checked = false;
        if (modalSigFile) modalSigFile.value = '';
        this.showToast('ลบลายเซ็นออกแล้ว (จะไม่มีรูปลายเซ็นประทับลงในเอกสาร A4)', 'info');
      });
    }

    document.querySelectorAll('.btn-review-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const text = btn.getAttribute('data-text');
        const commentEl = document.getElementById('review-modal-comment');
        if (commentEl && text) {
          commentEl.value = text;
        }
      });
    });
  }

  openReviewModal(recordId, role) {
    const record = window.storageMgr.getRecordById(recordId);
    if (!record) return;

    // ตรวจสอบลำดับการตรวจ: หาก ผอ. พยายามตรวจรายการที่วิชาการยังไม่ได้ตรวจ
    if (role === 'director' && !window.storageMgr.isAcademicReviewed(record)) {
      this.showToast('ไม่สามารถตรวจได้: ต้องผ่านการตรวจและลงนามของหัวหน้ากลุ่มบริหารวิชาการก่อน', 'warning');
      return;
    }

    this.activeReviewRecordId = recordId;
    this.activeReviewRole = role;

    const modal = document.getElementById('review-modal');
    const titleEl = document.getElementById('review-modal-title');
    const teacherNameEl = document.getElementById('review-modal-teacher');
    const topicEl = document.getElementById('review-modal-topic');
    const commentEl = document.getElementById('review-modal-comment');
    const dateEl = document.getElementById('review-modal-signdate');
    const sigImgEl = document.getElementById('preview-review-sig');
    const btnDeleteSig = document.getElementById('btn-delete-review-sig');

    const currentUser = window.storageMgr.getCurrentUser();
    const today = new Date().toISOString().split('T')[0];

    const sug = window.storageMgr.getContextualSuggestions(record.topic || '', record.subject || '');

    if (role === 'academic') {
      titleEl.textContent = '✍️ ตรวจและแสดงความคิดเห็น: หัวหน้ากลุ่มบริหารงานวิชาการ';
      commentEl.value = record.academicComment || sug.academicComment;
      dateEl.value = record.academicSignDate || today;
      if (record.academicSignature === '') {
        this.currentReviewSigBase64 = ''; // ถูกลบออกในบันทึกนี้
      } else {
        this.currentReviewSigBase64 = record.academicSignature || currentUser?.signatureImg || '';
      }
    } else {
      titleEl.textContent = '✍️ ตรวจและอนุมัติ: ผู้อำนวยการโรงเรียน';
      commentEl.value = record.directorComment || sug.directorComment;
      dateEl.value = record.directorSignDate || today;
      if (record.directorSignature === '') {
        this.currentReviewSigBase64 = ''; // ถูกลบออกในบันทึกนี้
      } else {
        this.currentReviewSigBase64 = record.directorSignature || currentUser?.signatureImg || '';
      }
    }

    const stampCheckbox = document.getElementById('review-modal-stamp-sig');
    if (stampCheckbox) {
      stampCheckbox.checked = Boolean(this.currentReviewSigBase64);
    }

    if (this.currentReviewSigBase64) {
      sigImgEl.src = this.currentReviewSigBase64;
      sigImgEl.classList.remove('hidden');
      if (btnDeleteSig) btnDeleteSig.classList.remove('hidden');
    } else {
      sigImgEl.src = '';
      sigImgEl.classList.add('hidden');
      if (btnDeleteSig) btnDeleteSig.classList.add('hidden');
    }

    const modalSigFile = document.getElementById('review-modal-sigfile');
    if (modalSigFile) modalSigFile.value = '';

    teacherNameEl.textContent = `${record.teacherName} (ชั้น ${record.grade}) วิชา ${record.subject || '-'}`;
    topicEl.textContent = `${record.topic} (ภาคเรียนที่ ${record.semester || '1'}/${record.academicYear || '2567'})`;

    modal.classList.remove('hidden');
  }

  closeReviewModal() {
    const modal = document.getElementById('review-modal');
    if (modal) modal.classList.add('hidden');
    this.activeReviewRecordId = null;
    this.activeReviewRole = null;
    this.currentReviewSigBase64 = null;
  }

  // --- 5. แอดมินจัดการบัญชีแยกส่วน (Admin Accounts) ---
  switchAdminAccountSubtab(subtab) {
    this.currentAdminSubtab = subtab;
    
    const btnTeachers = document.getElementById('subtab-btn-teachers');
    const btnAcademic = document.getElementById('subtab-btn-academic');
    const btnDirector = document.getElementById('subtab-btn-director');

    [btnTeachers, btnAcademic, btnDirector].forEach(btn => {
      if (btn) {
        btn.className = 'admin-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    });

    document.querySelectorAll('.admin-account-panel').forEach(p => p.classList.add('hidden'));

    if (subtab === 'teachers') {
      if (btnTeachers) btnTeachers.className = 'admin-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-blue-600 text-white shadow-xs';
      const panel = document.getElementById('admin-panel-teachers');
      if (panel) panel.classList.remove('hidden');
    } else if (subtab === 'academic') {
      if (btnAcademic) btnAcademic.className = 'admin-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-purple-600 text-white shadow-xs';
      const panel = document.getElementById('admin-panel-academic');
      if (panel) panel.classList.remove('hidden');
    } else if (subtab === 'director') {
      if (btnDirector) btnDirector.className = 'admin-subtab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 bg-emerald-600 text-white shadow-xs';
      const panel = document.getElementById('admin-panel-director');
      if (panel) panel.classList.remove('hidden');
    }
  }

  setupAdminAccountEvents() {
    // 1. ฟอร์มเพิ่มบัญชีครู
    const formAddTeacher = document.getElementById('form-admin-add-account');
    if (formAddTeacher) {
      formAddTeacher.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('new-acc-username').value.trim();
        const password = document.getElementById('new-acc-password').value.trim();
        const name = document.getElementById('new-acc-name').value.trim();
        const position = document.getElementById('new-acc-position').value;
        const rank = document.getElementById('new-acc-rank').value;
        const subjectGroup = document.getElementById('new-acc-group').value;
        const subjects = document.getElementById('new-acc-subjects').value.trim();

        if (!username || !password || !name) {
          this.showToast('กรุณากรอก Username, Password และชื่อผู้ใช้งาน', 'error');
          return;
        }

        try {
          window.storageMgr.createUserAccount({
            username,
            password,
            name,
            role: 'teacher',
            position,
            rank,
            subjectGroup,
            subjects,
            activeSubject: subjects ? subjects.split(',')[0].trim() : subjectGroup,
            activityHours: '1 ชั่วโมง'
          });

          this.renderAccountsTable();
          formAddTeacher.reset();
          this.showToast(`สร้างบัญชีครูให้คุณ "${name}" สำเร็จ`, 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // 2. ฟอร์มจัดการบัญชีหัวหน้ากลุ่มบริหารวิชาการ
    const formAcademic = document.getElementById('form-admin-academic');
    if (formAcademic) {
      formAcademic.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('academic-acc-username').value.trim();
        const password = document.getElementById('academic-acc-password').value.trim();
        const name = document.getElementById('academic-acc-name').value.trim();
        const position = document.getElementById('academic-acc-position').value;
        const rank = document.getElementById('academic-acc-rank').value;

        if (!username || !name) {
          this.showToast('กรุณากรอก Username และชื่อหัวหน้าวิชาการ', 'error');
          return;
        }

        try {
          window.storageMgr.saveAcademicHeadAccount({ username, password, name, position, rank });
          this.renderAccountsTable();
          this.loadSettingsToUI();
          this.showToast('บันทึกและอัปเดตบัญชีหัวหน้ากลุ่มบริหารวิชาการสำเร็จ', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // 3. ฟอร์มจัดการบัญชีผู้อำนวยการโรงเรียน
    const formDirector = document.getElementById('form-admin-director');
    if (formDirector) {
      formDirector.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('director-acc-username').value.trim();
        const password = document.getElementById('director-acc-password').value.trim();
        const name = document.getElementById('director-acc-name').value.trim();
        const position = document.getElementById('director-acc-position').value.trim();
        const rank = document.getElementById('director-acc-rank').value;

        if (!username || !name) {
          this.showToast('กรุณากรอก Username และชื่อผู้อำนวยการโรงเรียน', 'error');
          return;
        }

        try {
          window.storageMgr.saveDirectorAccount({ username, password, name, position, rank });
          this.renderAccountsTable();
          this.loadSettingsToUI();
          this.showToast('บันทึกและอัปเดตบัญชีผู้อำนวยการโรงเรียนสำเร็จ', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // 4. ฟอร์มแก้ไขข้อมูลบัญชีครูผู้สอน (Modal) โดยผู้ดูแลระบบ
    const formEditTeacher = document.getElementById('form-admin-edit-teacher');
    if (formEditTeacher) {
      formEditTeacher.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-teacher-id').value;
        const username = document.getElementById('edit-teacher-username').value.trim();
        const password = document.getElementById('edit-teacher-password').value.trim();
        const name = document.getElementById('edit-teacher-name').value.trim();
        const position = document.getElementById('edit-teacher-position').value;
        const rank = document.getElementById('edit-teacher-rank').value;
        const subjectGroup = document.getElementById('edit-teacher-group').value;
        const subjects = document.getElementById('edit-teacher-subjects').value.trim();

        if (!id || !username || !password || !name) {
          this.showToast('กรุณากรอก Username, Password และชื่อ-นามสกุลครูผู้สอน', 'error');
          return;
        }

        // ตรวจสอบชื่อผู้ใช้ (Username) ซ้ำกับบัญชีอื่น
        const accounts = window.storageMgr.getAccounts();
        const duplicate = accounts.find(a => a.username.trim() === username && a.id !== id);
        if (duplicate) {
          this.showToast(`ชื่อผู้ใช้ (Username) "${username}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`, 'error');
          return;
        }

        try {
          const subList = subjects 
            ? subjects.split(',').map(s => s.trim()).filter(Boolean) 
            : [subjectGroup || 'ภาษาไทย'];

          window.storageMgr.updateAccount(id, {
            username,
            password,
            name,
            position,
            rank,
            subjectGroup,
            subjects: subList.join(', '),
            subjectList: subList,
            title: position || 'ครูผู้สอน'
          });

          this.closeEditTeacherModal();
          this.renderAccountsTable();
          if (window.formMgr) window.formMgr.populateTeacherDropdown();
          if (window.dashboardMgr) window.dashboardMgr.updateFilterDropdowns();
          this.showToast(`บันทึกการแก้ไขข้อมูลบัญชีของ "${name}" สำเร็จ`, 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }
  }

  renderAccountsTable() {
    const tbody = document.getElementById('table-admin-accounts');
    const teachers = window.storageMgr.getTeachers();
    const countEl = document.getElementById('admin-teachers-count');
    if (countEl) countEl.textContent = `(ทั้งหมด ${teachers.length} บัญชี)`;

    if (tbody) {
      if (teachers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-slate-400 text-xs">
              <div class="text-3xl mb-1.5">👨‍🏫</div>
              <div class="font-bold text-slate-600">ยังไม่มีรายชื่อบัญชีครูผู้สอนในโรงเรียน</div>
              <div class="text-[11px] text-slate-400 mt-0.5">กรุณาใช้แบบฟอร์ม "ลงทะเบียนสร้างบัญชีครูผู้สอนใหม่" ทางด้านซ้ายมือ</div>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = teachers.map((acc, idx) => {
          const editBtn = `<button onclick="window.app.openEditTeacherModal('${acc.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition font-medium mr-1 border border-amber-200">✏️ แก้ไข</button>`;
          const deleteBtn = `<button onclick="window.app.deleteUserAccount('${acc.id}', '${acc.name}')" class="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded transition font-medium border border-red-200">🗑️ ลบ</button>`;
          const subs = window.storageMgr.getTeacherSubjectList(acc).join(', ') || '-';

          return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
              <td class="py-2.5 px-3 text-center text-slate-400 text-xs">${idx + 1}</td>
              <td class="py-2.5 px-3 font-semibold text-slate-800 text-xs">${acc.username}</td>
              <td class="py-2.5 px-3 font-mono text-slate-600 text-xs">${acc.password}</td>
              <td class="py-2.5 px-3 text-slate-800 text-xs font-medium">
                <div>${acc.name}</div>
                <div class="text-[11px] text-slate-500">วิชา: ${subs}</div>
              </td>
              <td class="py-2.5 px-3 text-slate-600 text-xs">${acc.position || 'ครู'} ${acc.rank && acc.rank !== 'ไม่มีวิทยฐานะ' ? `(${acc.rank})` : ''}</td>
              <td class="py-2.5 px-3 text-right whitespace-nowrap">${editBtn}${deleteBtn}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // แสดงข้อมูลในส่วนหัวหน้าวิชาการ
    const academic = window.storageMgr.getAcademicHeadAccount();
    if (academic) {
      const nameEl = document.getElementById('info-academic-name');
      const credsEl = document.getElementById('info-academic-creds');
      if (nameEl) nameEl.textContent = `${academic.name} (${academic.position || 'ครู'} ${academic.rank || ''})`;
      if (credsEl) credsEl.innerHTML = `Username: <b class="font-mono text-slate-800">${academic.username}</b> | Password: <b class="font-mono text-slate-800">${academic.password}</b>`;

      const uEl = document.getElementById('academic-acc-username');
      const pEl = document.getElementById('academic-acc-password');
      const nEl = document.getElementById('academic-acc-name');
      const posEl = document.getElementById('academic-acc-position');
      const rankEl = document.getElementById('academic-acc-rank');

      if (uEl) uEl.value = academic.username;
      if (pEl) pEl.value = academic.password;
      if (nEl) nEl.value = academic.name;
      if (posEl && academic.position) posEl.value = academic.position;
      if (rankEl && academic.rank) rankEl.value = academic.rank;
    }

    // แสดงข้อมูลในส่วนผู้อำนวยการโรงเรียน
    const director = window.storageMgr.getDirectorAccount();
    if (director) {
      const nameEl = document.getElementById('info-director-name');
      const credsEl = document.getElementById('info-director-creds');
      if (nameEl) nameEl.textContent = `${director.name} (${director.position || 'ผู้อำนวยการโรงเรียน'} ${director.rank || ''})`;
      if (credsEl) credsEl.innerHTML = `Username: <b class="font-mono text-slate-800">${director.username}</b> | Password: <b class="font-mono text-slate-800">${director.password}</b>`;

      const uEl = document.getElementById('director-acc-username');
      const pEl = document.getElementById('director-acc-password');
      const nEl = document.getElementById('director-acc-name');
      const posEl = document.getElementById('director-acc-position');
      const rankEl = document.getElementById('director-acc-rank');

      if (uEl) uEl.value = director.username;
      if (pEl) pEl.value = director.password;
      if (nEl) nEl.value = director.name;
      if (posEl && director.position) posEl.value = director.position;
      if (rankEl && director.rank) rankEl.value = director.rank;
    }
  }

  // เปิดหน้าต่าง Modal แก้ไขบัญชีครูผู้สอน
  openEditTeacherModal(teacherId) {
    const teacher = window.storageMgr.getAccountById(teacherId);
    if (!teacher) {
      this.showToast('ไม่พบข้อมูลบัญชีครูที่ต้องการแก้ไข', 'error');
      return;
    }

    this.populateProfileDropdowns();

    const idEl = document.getElementById('edit-teacher-id');
    const uEl = document.getElementById('edit-teacher-username');
    const pEl = document.getElementById('edit-teacher-password');
    const nEl = document.getElementById('edit-teacher-name');
    const posEl = document.getElementById('edit-teacher-position');
    const rankEl = document.getElementById('edit-teacher-rank');
    const grpEl = document.getElementById('edit-teacher-group');
    const subsEl = document.getElementById('edit-teacher-subjects');

    if (idEl) idEl.value = teacher.id;
    if (uEl) uEl.value = teacher.username || '';
    if (pEl) pEl.value = teacher.password || '';
    if (nEl) nEl.value = teacher.name || '';
    if (posEl) posEl.value = teacher.position || 'ครู';
    if (rankEl) rankEl.value = teacher.rank || 'ไม่มีวิทยฐานะ';
    if (grpEl) grpEl.value = teacher.subjectGroup || 'ภาษาไทย';
    if (subsEl) subsEl.value = teacher.subjects || '';

    const modal = document.getElementById('modal-admin-edit-teacher');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  // ปิดหน้าต่าง Modal แก้ไขบัญชีครูผู้สอน
  closeEditTeacherModal() {
    const modal = document.getElementById('modal-admin-edit-teacher');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  deleteUserAccount(id, name) {
    if (confirm(`คุณต้องการลบบัญชีของ "${name}" ใช่หรือไม่?`)) {
      try {
        window.storageMgr.deleteAccount(id);
        this.renderAccountsTable();
        this.showToast(`ลบบัญชี "${name}" เรียบร้อยแล้ว`, 'info');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    }
  }

  // --- 6. ตั้งค่าโรงเรียน & สำรองข้อมูล ---
  setupSettingsEvents() {
    const formSettings = document.getElementById('school-settings-form');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        const settings = window.storageMgr.getSettings();

        settings.schoolName = document.getElementById('setting-school-name').value.trim();
        settings.schoolAddress = document.getElementById('setting-school-address').value.trim();
        settings.academicHead = document.getElementById('setting-academic-head').value.trim();
        settings.academicHeadTitle = document.getElementById('setting-academic-head-title').value.trim();
        settings.directorName = document.getElementById('setting-director-name').value.trim();
        settings.directorTitle = document.getElementById('setting-director-title').value.trim();

        window.storageMgr.saveSettings(settings);
        this.updateHeaderBrand();
        this.showToast('บันทึกข้อมูลพื้นฐานโรงเรียนเรียบร้อยแล้ว', 'success');
      });
    }

    const inputLogo = document.getElementById('input-school-logo');
    if (inputLogo) {
      inputLogo.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const base64 = await window.compressImageFile(file, 200, 200, 0.75, false);
          if (!base64) {
            this.showToast('ไม่สามารถอ่านไฟล์ Logo ได้', 'error');
            return;
          }
          const settings = window.storageMgr.getSettings();
          settings.logo = base64;
          window.storageMgr.saveSettings(settings);
          this.updateLogoPreview(base64);
          this.updateHeaderBrand();
          this.showToast('อัปเดต Logo โรงเรียนสำเร็จ', 'success');
        } catch (err) {
          this.showToast(`บันทึก Logo ไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
    }

    const btnRemoveLogo = document.getElementById('btn-remove-logo');
    if (btnRemoveLogo) {
      btnRemoveLogo.addEventListener('click', () => {
        if (confirm('คุณต้องการลบ Logo โรงเรียนใช่หรือไม่?')) {
          const settings = window.storageMgr.getSettings();
          settings.logo = null;
          window.storageMgr.saveSettings(settings);
          this.updateLogoPreview(null);
          this.updateHeaderBrand();
          this.showToast('ลบ Logo เรียบร้อยแล้ว', 'info');
        }
      });
    }

    const btnOptimize = document.getElementById('btn-optimize-storage');
    if (btnOptimize) {
      btnOptimize.addEventListener('click', async () => {
        this.showToast('กำลังตรวจสอบและบีบอัดรูปภาพเพื่อคืนพื้นที่ว่าง...', 'info');
        await window.storageMgr.autoOptimizeStorage();
        this.showToast('บีบอัดรูปภาพและคืนพื้นที่ว่างในเบราว์เซอร์สำเร็จ 100%!', 'success');
      });
    }

    const btnBackup = document.getElementById('btn-backup-data');
    if (btnBackup) {
      btnBackup.addEventListener('click', () => {
        const jsonStr = window.storageMgr.exportBackupJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `backup_school_data_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อยแล้ว', 'success');
      });
    }

    const inputRestore = document.getElementById('input-restore-file');
    if (inputRestore) {
      inputRestore.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const result = window.storageMgr.importBackupJSON(evt.target.result);
          if (result.success) {
            this.showToast('นำเข้าข้อมูลสำเร็จ ระบบจะรีโหลดข้อมูลใหม่', 'success');
            setTimeout(() => location.reload(), 1200);
          } else {
            this.showToast('เกิดข้อผิดพลาด: ' + result.error, 'error');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  loadSettingsToUI() {
    const settings = window.storageMgr.getSettings();
    const elName = document.getElementById('setting-school-name');
    const elAddr = document.getElementById('setting-school-address');
    const elAcad = document.getElementById('setting-academic-head');
    const elAcadTitle = document.getElementById('setting-academic-head-title');
    const elDir = document.getElementById('setting-director-name');
    const elDirTitle = document.getElementById('setting-director-title');

    if (elName) elName.value = settings.schoolName || '';
    if (elAddr) elAddr.value = settings.schoolAddress || '';
    if (elAcad) elAcad.value = settings.academicHead || '';
    if (elAcadTitle) elAcadTitle.value = settings.academicHeadTitle || '';
    if (elDir) elDir.value = settings.directorName || '';
    if (elDirTitle) elDirTitle.value = settings.directorTitle || '';

    this.updateLogoPreview(settings.logo);
    this.updateHeaderBrand();
  }

  updateLogoPreview(logoSrc) {
    const imgEl = document.getElementById('preview-logo-img');
    const placeholder = document.getElementById('logo-placeholder');
    const btnRemove = document.getElementById('btn-remove-logo');

    if (logoSrc) {
      if (imgEl) { imgEl.src = logoSrc; imgEl.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnRemove) btnRemove.classList.remove('hidden');
    } else {
      if (imgEl) { imgEl.src = ''; imgEl.classList.add('hidden'); }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnRemove) btnRemove.classList.add('hidden');
    }
  }

  updateHeaderBrand() {
    const settings = window.storageMgr.getSettings();
    const brandName = document.getElementById('header-school-name');
    const brandLogo = document.getElementById('header-school-logo');

    if (brandName) brandName.textContent = settings.schoolName || 'ระบบบันทึกหลังสอน';

    if (brandLogo) {
      if (settings.logo) {
        brandLogo.innerHTML = `<img src="${settings.logo}" alt="Logo" class="w-10 h-10 object-contain rounded-md" />`;
      } else {
        brandLogo.innerHTML = `
          <div class="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-lg shadow-sm">
            🏫
          </div>
        `;
      }
    }
  }

  confirmDeleteRecord(id) {
    const record = window.storageMgr.getRecordById(id);
    const title = record ? record.topic : 'รายการนี้';
    if (confirm(`คุณต้องการลบบันทึก "${title}" ใช่หรือไม่?`)) {
      window.storageMgr.deleteRecord(id);
      window.dashboardMgr.render();
      window.dashboardMgr.renderHistoryTable();
      this.showToast('ลบบันทึกหลังสอนเรียบร้อยแล้ว', 'info');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <div style="font-size: 1.2rem;">${icon}</div>
      <div style="flex: 1; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- 8. ระบบแจ้งเตือนครูผู้สอนเมื่อขาดส่งบันทึก >= 5 วัน ---
  checkTeacherSubmissionLagAlert(user, force = false) {
    if (!user || user.role !== 'teacher') return;

    const sessionKey = 'lag_alert_shown_' + (user.id || user.username);
    if (!force && sessionStorage.getItem(sessionKey)) {
      return;
    }

    const allRecords = window.storageMgr.getRecords();
    const teacherRecords = allRecords.filter(r => 
      r.teacherId === user.id || 
      r.teacherUsername === user.username ||
      (r.teacherName && user.name && r.teacherName.trim() === user.name.trim())
    );

    let diffDays = null;
    let shouldAlert = false;

    if (teacherRecords.length === 0) {
      // ครูยังไม่เคยส่งบันทึกหลังสอนเลย
      shouldAlert = true;
      diffDays = null;
    } else {
      teacherRecords.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      const latest = teacherRecords[0];
      const dRec = new Date(latest.date || latest.createdAt);
      if (!isNaN(dRec.getTime())) {
        dRec.setHours(0, 0, 0, 0);
        const dNow = new Date();
        dNow.setHours(0, 0, 0, 0);
        diffDays = Math.max(0, Math.floor((dNow.getTime() - dRec.getTime()) / (1000 * 60 * 60 * 24)));
        if (diffDays >= 5) {
          shouldAlert = true;
        }
      }
    }

    if (shouldAlert) {
      sessionStorage.setItem(sessionKey, 'true');
      const modal = document.getElementById('modal-teacher-alert');
      const msgEl = document.getElementById('teacher-alert-message');
      if (msgEl) {
        if (diffDays !== null && diffDays >= 5) {
          msgEl.textContent = `"คุณครูไม่ได้บันทึกหลังแผนมา ${diffDays} วันแล้ว รีบดำเนินการด้วยนะครับ ผู้อำนวยการกำลังติดตาม ขอบคุณครับ"`;
        } else {
          msgEl.textContent = `"คุณครูไม่ได้บันทึกหลังแผนมา 5 วันแล้ว รีบดำเนินการด้วยนะครับ ผู้อำนวยการกำลังติดตาม ขอบคุณครับ"`;
        }
      }
      if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      }
    }
  }

  closeTeacherAlertModal() {
    const modal = document.getElementById('modal-teacher-alert');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  goToFormFromAlert() {
    this.closeTeacherAlertModal();
    this.switchTab('tab-form');
  }
}

window.app = new App();
