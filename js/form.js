/**
 * form.js - จัดการฟอร์มบันทึกหลังสอน, ระบบแนะนำข้อความสอดคล้องกับเรื่องที่สอน, และอัปโหลดภาพกิจกรรม 2 รูป
 */

class FormManager {
  constructor() {
    this.form = null;
    this.photo1Base64 = null;
    this.photo2Base64 = null;
    this.init();
  }

  init() {
    this.form = document.getElementById('lesson-record-form');
    if (!this.form) return;

    // การคำนวณร้อยละ
    const calcInputs = ['input-total-students', 'input-level1-count', 'input-level2-count', 'input-level3-count', 'input-level4-count'];
    calcInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.calculatePercentages());
      }
    });

    // Form Submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Reset Form button
    const btnReset = document.getElementById('btn-reset-form');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetForm());
    }

    // วันที่เริ่มต้น
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('input-date');
    if (dateInput && !dateInput.value) dateInput.value = today;

    const teacherSignDateEl = document.getElementById('input-teacher-signdate');
    if (teacherSignDateEl && !teacherSignDateEl.value) teacherSignDateEl.value = today;

    this.populateTeacherDropdown();
    this.setupQuickTags();
    this.populateHoursDropdown();
    this.setupMultiSubjectHandler();
    this.setupSmartSuggestionEngine();
    this.setupActivityPhotosHandler();
  }

  populateHoursDropdown(selectedVal = '1 ชั่วโมง') {
    const select = document.getElementById('input-hours');
    if (!select) return;

    select.innerHTML = '';
    const hours = window.PROFILE_OPTIONS.activityHours || ['1 ชั่วโมง', '2 ชั่วโมง', '3 ชั่วโมง', '4 ชั่วโมง'];
    hours.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === selectedVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // ระบบข้อความแนะนำแบบกลาง ๆ (มาตรฐานที่ใช้ได้กับทุกวิชาและทุกแผน)
  setupSmartSuggestionEngine() {
    const btnSmart = document.getElementById('btn-smart-suggest');

    if (btnSmart) {
      btnSmart.addEventListener('click', () => {
        const suggestions = window.storageMgr.getGeneralSuggestions();

        const skillEl = document.getElementById('input-skill');
        const attEl = document.getElementById('input-attitude');
        const probEl = document.getElementById('input-problem');
        const solEl = document.getElementById('input-solution');

        if (skillEl) skillEl.value = suggestions.skill;
        if (attEl) attEl.value = suggestions.attitude;
        if (probEl) probEl.value = suggestions.problem;
        if (solEl) solEl.value = suggestions.solution;

        window.app.showToast('กรอกข้อความแนะนำแบบกลาง ๆ ลงในทุกช่องเรียบร้อยแล้ว', 'success');
      });
    }

    // เมื่อกดปุ่มแนะนำแบบกลาง ๆ รายช่อง
    document.querySelectorAll('.btn-general-suggest').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const type = btn.getAttribute('data-type');
        const sug = window.storageMgr.getGeneralSuggestions();
        const target = document.getElementById(targetId);
        if (target && sug[type]) {
          target.value = sug[type];
          window.app.showToast('กรอกข้อความแนะนำแบบกลาง ๆ เรียบร้อย', 'info');
        }
      });
    });

    // ปุ่มตัวเลือกข้อความด่วนแบบกลางๆ (Pill presets)
    document.querySelectorAll('.btn-preset-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const text = btn.getAttribute('data-text');
        const target = document.getElementById(targetId);
        if (target && text) {
          target.value = text;
          window.app.showToast('เลือกข้อความด่วนเรียบร้อย', 'info');
        }
      });
    });
  }

  // ระบบอัปโหลดและจัดการรูปภาพกิจกรรมการเรียนรู้ 2 รูป (พร้อม Auto Compression ป้องกันโควตาเต็ม)
  setupActivityPhotosHandler() {
    const setupPhoto = (inputId, previewId, placeholderId, removeBtnId, photoKey) => {
      const inputEl = document.getElementById(inputId);
      const previewEl = document.getElementById(previewId);
      const placeholderEl = document.getElementById(placeholderId);
      const removeBtn = document.getElementById(removeBtnId);

      if (inputEl) {
        inputEl.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const isImg = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|bmp|jfif|heic|avif)$/i.test(file.name);
          if (!isImg) {
            window.app.showToast('กรุณาเลือกไฟล์รูปภาพ (.jpg, .png, .webp ฯลฯ)', 'error');
            return;
          }

          // บีบอัดรูปภาพกิจกรรมให้อยู่ในขนาดกะทัดรัด คมชัดพอดี 1 หน้า A4 (400x300 px คุณภาพ 0.65 JPEG ขนาดเพียง ~12-15 KB)
          const base64 = await window.compressImageFile(file, 400, 300, 0.65, true);
          if (!base64) {
            window.app.showToast('ไม่สามารถประมวลผลรูปภาพได้ กรุณาลองใหม่อีกครั้ง', 'error');
            return;
          }

          this[photoKey] = base64;
          if (previewEl) {
            previewEl.src = base64;
            previewEl.classList.remove('hidden');
          }
          if (placeholderEl) placeholderEl.classList.add('hidden');
          if (removeBtn) removeBtn.classList.remove('hidden');
          window.app.showToast('อัปโหลดและปรับขนาดรูปภาพกิจกรรมเรียบร้อยแล้ว', 'success');
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this[photoKey] = null;
          if (inputEl) inputEl.value = '';
          if (previewEl) {
            previewEl.src = '';
            previewEl.classList.add('hidden');
          }
          if (placeholderEl) placeholderEl.classList.remove('hidden');
          removeBtn.classList.add('hidden');
          window.app.showToast('ลบรูปภาพกิจกรรมออกแล้ว', 'info');
        });
      }
    };

    setupPhoto('input-activity-photo1', 'preview-activity-photo1', 'placeholder-photo1', 'btn-remove-photo1', 'photo1Base64');
    setupPhoto('input-activity-photo2', 'preview-activity-photo2', 'placeholder-photo2', 'btn-remove-photo2', 'photo2Base64');
  }

  // จัดการการเลือกและการเพิ่มวิชาหลายวิชา
  setupMultiSubjectHandler() {
    const selectSubject = document.getElementById('input-subject-select');
    const inputSubject = document.getElementById('input-subject');
    const btnAddSubject = document.getElementById('btn-add-form-subject');

    if (selectSubject && inputSubject) {
      selectSubject.addEventListener('change', () => {
        const val = selectSubject.value;
        if (val === '__custom__') {
          inputSubject.value = '';
          inputSubject.focus();
        } else if (val) {
          inputSubject.value = val;
        }
      });
    }

    if (btnAddSubject) {
      btnAddSubject.addEventListener('click', () => {
        const newSub = prompt('ระบุชื่อรายวิชาใหม่ที่ต้องการบันทึก (เช่น ฟิสิกส์ ม.4, ภาษาอังกฤษ ม.2):');
        if (newSub && newSub.trim()) {
          const trimmed = newSub.trim();
          const currentUser = window.storageMgr.getCurrentUser();
          const teacherSelect = document.getElementById('input-teacher');
          const teacherId = (currentUser && currentUser.role === 'teacher')
            ? currentUser.id
            : (teacherSelect?.value || currentUser?.id);

          if (teacherId) {
            window.storageMgr.addTeacherSubject(teacherId, trimmed);
            this.populateSubjectDropdown(trimmed);
            if (inputSubject) inputSubject.value = trimmed;
            window.app.showToast(`เพิ่มวิชา "${trimmed}" เรียบร้อยแล้ว`, 'success');
          }
        }
      });
    }
  }

  populateSubjectDropdown(selectedSubject = '') {
    const select = document.getElementById('input-subject-select');
    const inputSubject = document.getElementById('input-subject');
    if (!select) return;

    const currentUser = window.storageMgr.getCurrentUser();
    const teacherSelect = document.getElementById('input-teacher');
    let teacher = currentUser;

    if (currentUser && currentUser.role !== 'teacher') {
      const tId = teacherSelect?.value;
      if (tId) {
        teacher = window.storageMgr.getAccountById(tId) || currentUser;
      }
    }

    const subjects = window.storageMgr.getTeacherSubjectList(teacher);

    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- เลือกวิชาจากรายการที่สอน --';
    select.appendChild(defaultOpt);

    subjects.forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = sub;
      if (selectedSubject && sub === selectedSubject) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '✏️ ระบุวิชาอื่น ๆ ด้วยตนเอง...';
    select.appendChild(customOpt);

    if (selectedSubject) {
      if (inputSubject) inputSubject.value = selectedSubject;
    } else if (subjects.length > 0) {
      const active = teacher?.activeSubject || subjects[0];
      select.value = active;
      if (inputSubject && !inputSubject.value) inputSubject.value = active;
    }
  }

  populateTeacherDropdown(selectedId = '') {
    const select = document.getElementById('input-teacher');
    if (!select) return;

    const currentUser = window.storageMgr.getCurrentUser();
    const teachers = window.storageMgr.getTeachers();

    select.innerHTML = '';

    if (currentUser && currentUser.role === 'teacher') {
      const opt = document.createElement('option');
      opt.value = currentUser.id;
      opt.textContent = `${currentUser.name} (${currentUser.position || 'ครู'})`;
      opt.selected = true;
      select.appendChild(opt);
      select.disabled = true;
      this.populateSubjectDropdown();
    } else {
      select.disabled = false;
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- เลือกครูผู้สอนจากฐานข้อมูล --';
      select.appendChild(defaultOpt);

      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.position || 'ครู'})`;
        if (selectedId && (t.id === selectedId || t.name === selectedId)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      select.addEventListener('change', () => {
        this.populateSubjectDropdown();
      });
    }
  }

  autoFillFromCurrentUser() {
    const user = window.storageMgr.getCurrentUser();
    if (!user || user.role !== 'teacher') return;

    this.populateSubjectDropdown(user.activeSubject);

    if (user.activityHours) {
      this.populateHoursDropdown(user.activityHours);
    }
  }

  calculatePercentages() {
    const totalEl = document.getElementById('input-total-students');
    const total = parseInt(totalEl?.value || 0, 10);

    const l1 = parseInt(document.getElementById('input-level1-count')?.value || 0, 10);
    const l2 = parseInt(document.getElementById('input-level2-count')?.value || 0, 10);
    const l3 = parseInt(document.getElementById('input-level3-count')?.value || 0, 10);
    const l4 = parseInt(document.getElementById('input-level4-count')?.value || 0, 10);

    const sum = l1 + l2 + l3 + l4;

    const p1 = total > 0 ? (l1 / total) * 100 : 0;
    const p2 = total > 0 ? (l2 / total) * 100 : 0;
    const p3 = total > 0 ? (l3 / total) * 100 : 0;
    const p4 = total > 0 ? (l4 / total) * 100 : 0;

    document.getElementById('val-level1-pct').textContent = p1.toFixed(2) + '%';
    document.getElementById('val-level2-pct').textContent = p2.toFixed(2) + '%';
    document.getElementById('val-level3-pct').textContent = p3.toFixed(2) + '%';
    document.getElementById('val-level4-pct').textContent = p4.toFixed(2) + '%';

    const bar1 = document.getElementById('bar-level1');
    const bar2 = document.getElementById('bar-level2');
    const bar3 = document.getElementById('bar-level3');
    const bar4 = document.getElementById('bar-level4');
    if (bar1) bar1.style.width = p1 + '%';
    if (bar2) bar2.style.width = p2 + '%';
    if (bar3) bar3.style.width = p3 + '%';
    if (bar4) bar4.style.width = p4 + '%';

    const alertEl = document.getElementById('calc-warning-msg');
    if (alertEl) {
      if (total > 0 && sum > total) {
        alertEl.textContent = `⚠️ ยอดรวมทั้ง 4 ระดับ (${sum} คน) เกินจำนวนนักเรียนทั้งหมด (${total} คน)`;
        alertEl.classList.remove('hidden');
      } else if (total > 0 && sum < total) {
        alertEl.textContent = `ℹ️ บันทึกแล้ว ${sum} คน จากทั้งหมด ${total} คน (ยังเหลือ ${total - sum} คน)`;
        alertEl.classList.remove('hidden');
      } else {
        alertEl.classList.add('hidden');
      }
    }

    return { total, l1, p1, l2, p2, l3, p3, l4, p4, sum };
  }

  setupQuickTags() {
    document.querySelectorAll('.btn-quick-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const text = btn.getAttribute('data-text');
        const target = document.getElementById(targetId);
        if (target && text) {
          target.value = target.value.trim().length > 0 ? target.value + ' ' + text : text;
        }
      });
    });
  }

  handleSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('form-record-id')?.value;
    const semester = document.getElementById('input-semester')?.value || '1';
    const academicYear = document.getElementById('input-academic-year')?.value.trim() || '2567';
    const date = document.getElementById('input-date').value;
    const unit = document.getElementById('input-unit').value.trim();
    const planNo = document.getElementById('input-planno').value.trim();
    const topic = document.getElementById('input-topic').value.trim();
    const grade = document.getElementById('input-grade').value.trim();
    const subject = document.getElementById('input-subject').value.trim();
    const hours = document.getElementById('input-hours').value;

    const teacherSelect = document.getElementById('input-teacher');
    let teacherId = teacherSelect.value;
    let teacherName = '';
    let teacherPosition = 'ครูผู้สอน';
    let teacherProfilePhoto = null;

    const currentUser = window.storageMgr.getCurrentUser();
    if (currentUser && currentUser.role === 'teacher') {
      teacherId = currentUser.id;
      teacherName = currentUser.name;
      teacherPosition = `${currentUser.position || 'ครู'} ${currentUser.rank && currentUser.rank !== 'ไม่มีวิทยฐานะ' ? currentUser.rank : ''}`.trim();
      teacherProfilePhoto = currentUser.profilePhoto || null;
    } else {
      const selectedTeacher = window.storageMgr.getAccountById(teacherId);
      if (selectedTeacher) {
        teacherName = selectedTeacher.name;
        teacherPosition = `${selectedTeacher.position || 'ครู'} ${selectedTeacher.rank && selectedTeacher.rank !== 'ไม่มีวิทยฐานะ' ? selectedTeacher.rank : ''}`.trim();
        teacherProfilePhoto = selectedTeacher.profilePhoto || null;
      } else {
        teacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text || '';
      }
    }

    if (!topic || !grade || !subject || !teacherName) {
      window.app.showToast('กรุณากรอกข้อมูลสำคัญ: เรื่อง, ระดับชั้น, วิชาที่บันทึก และครูผู้สอน', 'error');
      return;
    }

    if (teacherId && subject) {
      window.storageMgr.addTeacherSubject(teacherId, subject);
    }

    const calc = this.calculatePercentages();
    const existingRecord = recordId ? window.storageMgr.getRecordById(recordId) : null;

    const recordData = {
      teacherId,
      teacherUsername: currentUser ? currentUser.username : '',
      teacherName,
      teacherPosition,
      teacherProfilePhoto: teacherProfilePhoto || existingRecord?.teacherProfilePhoto || null,
      teacherSignature: (currentUser && currentUser.signatureImg) ? currentUser.signatureImg : (existingRecord?.teacherSignature || null),
      semester,
      academicYear,
      date: date || new Date().toISOString().split('T')[0],
      unit,
      planNo,
      topic,
      grade,
      subject,
      hours,
      activityPhoto1: this.photo1Base64 !== undefined ? this.photo1Base64 : (existingRecord?.activityPhoto1 || null),
      activityPhoto2: this.photo2Base64 !== undefined ? this.photo2Base64 : (existingRecord?.activityPhoto2 || null),
      knowledge: {
        totalStudents: calc.total,
        level1Count: calc.l1, level1Pct: calc.p1,
        level2Count: calc.l2, level2Pct: calc.p2,
        level3Count: calc.l3, level3Pct: calc.p3,
        level4Count: calc.l4, level4Pct: calc.p4
      },
      skill: document.getElementById('input-skill').value.trim(),
      attitude: document.getElementById('input-attitude').value.trim(),
      problem: document.getElementById('input-problem').value.trim(),
      solution: document.getElementById('input-solution').value.trim(),
      teacherSignDate: document.getElementById('input-teacher-signdate').value,
      // สถานะการตรวจ 2 ขั้นตอน (วิชาการ -> ผอ.)
      academicStatus: existingRecord ? (existingRecord.academicStatus || (existingRecord.academicSignature ? 'approved' : 'pending')) : 'pending',
      academicComment: existingRecord ? (existingRecord.academicComment || '') : '',
      academicSignature: existingRecord ? (existingRecord.academicSignature || null) : null,
      academicSignDate: existingRecord ? (existingRecord.academicSignDate || '') : '',
      directorStatus: existingRecord ? (existingRecord.directorStatus || (existingRecord.directorSignature ? 'approved' : 'waiting_academic')) : 'waiting_academic',
      directorComment: existingRecord ? (existingRecord.directorComment || '') : '',
      directorSignature: existingRecord ? (existingRecord.directorSignature || null) : null,
      directorSignDate: existingRecord ? (existingRecord.directorSignDate || '') : ''
    };

    try {
      let savedItem;
      if (recordId) {
        savedItem = window.storageMgr.updateRecord(recordId, recordData);
        window.app.showToast('อัปเดตบันทึกหลังสอนเรียบร้อยแล้ว', 'success');
      } else {
        savedItem = window.storageMgr.addRecord(recordData);
        window.app.showToast('บันทึกข้อมูลหลังสอนสำเร็จ!', 'success');
      }

      // รีเฟรชแดชบอร์ดและตารางประวัติทันที
      if (window.dashboardMgr) {
        window.dashboardMgr.render();
        window.dashboardMgr.renderHistoryTable();
      }

      if (e.submitter && e.submitter.id === 'btn-save-and-print') {
        window.printMgr.openPreview(savedItem.id);
      } else {
        window.app.switchTab('tab-history');
      }

      this.resetForm();
    } catch (err) {
      console.error('Error saving record:', err);
      window.app.showToast(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, 'error');
    }
  }

  loadForEdit(recordId) {
    const record = window.storageMgr.getRecordById(recordId);
    if (!record) return;

    document.getElementById('form-record-id').value = record.id;
    document.getElementById('form-title-text').textContent = 'แก้ไขบันทึกหลังกิจกรรมการจัดการเรียนรู้';
    
    const inputSemester = document.getElementById('input-semester');
    const inputYear = document.getElementById('input-academic-year');
    if (inputSemester) inputSemester.value = record.semester || '1';
    if (inputYear) inputYear.value = record.academicYear || '2567';

    document.getElementById('input-date').value = record.date || '';
    document.getElementById('input-unit').value = record.unit || '';
    document.getElementById('input-planno').value = record.planNo || '';
    document.getElementById('input-topic').value = record.topic || '';
    
    // ตั้งค่าระดับชั้น (รองรับ select option)
    const gradeSelect = document.getElementById('input-grade');
    if (gradeSelect) {
      let matched = false;
      for (let i = 0; i < gradeSelect.options.length; i++) {
        if (gradeSelect.options[i].value === record.grade) {
          gradeSelect.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched && record.grade) {
        const opt = document.createElement('option');
        opt.value = record.grade;
        opt.textContent = record.grade;
        opt.selected = true;
        gradeSelect.appendChild(opt);
      }
    }

    this.populateHoursDropdown(record.hours || '1 ชั่วโมง');
    this.populateTeacherDropdown(record.teacherId || record.teacherName);
    this.populateSubjectDropdown(record.subject || '');

    // รูปกิจกรรม 1 & 2
    this.photo1Base64 = record.activityPhoto1 || null;
    this.photo2Base64 = record.activityPhoto2 || null;

    const p1 = document.getElementById('preview-activity-photo1');
    const ph1 = document.getElementById('placeholder-photo1');
    const rm1 = document.getElementById('btn-remove-photo1');
    if (this.photo1Base64) {
      if (p1) { p1.src = this.photo1Base64; p1.classList.remove('hidden'); }
      if (ph1) ph1.classList.add('hidden');
      if (rm1) rm1.classList.remove('hidden');
    } else {
      if (p1) p1.classList.add('hidden');
      if (ph1) ph1.classList.remove('hidden');
      if (rm1) rm1.classList.add('hidden');
    }

    const p2 = document.getElementById('preview-activity-photo2');
    const ph2 = document.getElementById('placeholder-photo2');
    const rm2 = document.getElementById('btn-remove-photo2');
    if (this.photo2Base64) {
      if (p2) { p2.src = this.photo2Base64; p2.classList.remove('hidden'); }
      if (ph2) ph2.classList.add('hidden');
      if (rm2) rm2.classList.remove('hidden');
    } else {
      if (p2) p2.classList.add('hidden');
      if (ph2) ph2.classList.remove('hidden');
      if (rm2) rm2.classList.add('hidden');
    }

    const k = record.knowledge || {};
    document.getElementById('input-total-students').value = k.totalStudents || '';
    document.getElementById('input-level1-count').value = k.level1Count || 0;
    document.getElementById('input-level2-count').value = k.level2Count || 0;
    document.getElementById('input-level3-count').value = k.level3Count || 0;
    document.getElementById('input-level4-count').value = k.level4Count || 0;

    document.getElementById('input-skill').value = record.skill || '';
    document.getElementById('input-attitude').value = record.attitude || '';
    document.getElementById('input-problem').value = record.problem || '';
    document.getElementById('input-solution').value = record.solution || '';

    document.getElementById('input-teacher-signdate').value = record.teacherSignDate || record.date;

    this.calculatePercentages();
    window.app.switchTab('tab-form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm() {
    this.form.reset();
    document.getElementById('form-record-id').value = '';
    document.getElementById('form-title-text').textContent = 'บันทึกหลังกิจกรรมการจัดการเรียนรู้ (สร้างใหม่)';

    const inputSemester = document.getElementById('input-semester');
    const inputYear = document.getElementById('input-academic-year');
    if (inputSemester) inputSemester.value = '1';
    if (inputYear) inputYear.value = '2567';

    const gradeSelect = document.getElementById('input-grade');
    if (gradeSelect) gradeSelect.selectedIndex = 0;

    this.photo1Base64 = null;
    this.photo2Base64 = null;

    ['1', '2'].forEach(num => {
      const p = document.getElementById(`preview-activity-photo${num}`);
      const ph = document.getElementById(`placeholder-photo${num}`);
      const rm = document.getElementById(`btn-remove-photo${num}`);
      const inp = document.getElementById(`input-activity-photo${num}`);
      if (inp) inp.value = '';
      if (p) { p.src = ''; p.classList.add('hidden'); }
      if (ph) ph.classList.remove('hidden');
      if (rm) rm.classList.add('hidden');
    });

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('input-date').value = today;
    document.getElementById('input-teacher-signdate').value = today;

    this.populateTeacherDropdown();
    this.autoFillFromCurrentUser();
    this.calculatePercentages();
  }
}

window.formMgr = new FormManager();
