/**
 * dashboard.js - จัดการการแสดงผลสถิติ กราฟ และประวัติการบันทึกตามบทบาทผู้ใช้
 */

class DashboardManager {
  constructor() {
    this.chartLevel = null;
    this.chartGrade = null;
    this.init();
  }

  init() {
    this.setupFilters();
  }

  getFilteredRecordsForCurrentUser() {
    const allRecords = window.storageMgr.getRecords();
    const currentUser = window.storageMgr.getCurrentUser();

    if (!currentUser) return [];

    // ครูผู้สอน: เห็นเฉพาะของตนเอง
    if (currentUser.role === 'teacher') {
      return allRecords.filter(r => r.teacherId === currentUser.id || r.teacherUsername === currentUser.username || r.teacherName === currentUser.name);
    }

    // แอดมิน, วิชาการ, ผอ. : เห็นของทุกคน
    return allRecords;
  }

  render() {
    const records = this.getFilteredRecordsForCurrentUser();
    const allTeachers = window.storageMgr.getTeachers();
    const currentUser = window.storageMgr.getCurrentUser();

    // 1. คำนวณค่าสถิติ
    const totalRecords = records.length;
    const teachersRecorded = new Set(records.map(r => r.teacherName).filter(Boolean)).size;

    let totalStudents = 0;
    let l1Total = 0, l2Total = 0, l3Total = 0, l4Total = 0;
    const gradeCountMap = {};

    records.forEach(r => {
      const k = r.knowledge || {};
      totalStudents += parseInt(k.totalStudents || 0, 10);
      l1Total += parseInt(k.level1Count || 0, 10);
      l2Total += parseInt(k.level2Count || 0, 10);
      l3Total += parseInt(k.level3Count || 0, 10);
      l4Total += parseInt(k.level4Count || 0, 10);

      const g = r.grade || 'ไม่ระบุชั้น';
      gradeCountMap[g] = (gradeCountMap[g] || 0) + 1;
    });

    const goodRate = totalStudents > 0 
      ? (((l3Total + l4Total) / totalStudents) * 100).toFixed(1) 
      : '0.0';

    // อัปเดตตัวเลข
    const elTotalRecords = document.getElementById('stat-total-records');
    const elTeachers = document.getElementById('stat-total-teachers');
    const elStudents = document.getElementById('stat-total-students');
    const elGoodRate = document.getElementById('stat-good-rate');

    if (elTotalRecords) elTotalRecords.textContent = totalRecords.toLocaleString();
    if (elTeachers) {
      if (currentUser?.role === 'teacher') {
        elTeachers.textContent = currentUser.name;
      } else {
        elTeachers.textContent = `${teachersRecorded} / ${allTeachers.length} ท่าน`;
      }
    }
    if (elStudents) elStudents.textContent = totalStudents.toLocaleString() + ' คน';
    if (elGoodRate) elGoodRate.textContent = goodRate + '%';

    // 2. กราฟ
    this.renderLevelChart(l1Total, l2Total, l3Total, l4Total);
    this.renderGradeChart(gradeCountMap);

    // 3. ตารางล่าสุดบนแดชบอร์ด
    this.renderRecentTable(records.slice(0, 5));

    // 4. ตารางประวัติทั้งหมด
    this.renderHistoryTable();
  }

  renderLevelChart(l1, l2, l3, l4) {
    const ctx = document.getElementById('chart-levels');
    if (!ctx) return;

    if (this.chartLevel) {
      this.chartLevel.destroy();
    }

    if (typeof Chart === 'undefined') return;

    const total = l1 + l2 + l3 + l4;
    const dataValues = total === 0 ? [0, 0, 0, 0] : [l1, l2, l3, l4];

    this.chartLevel = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['เริ่มต้น', 'พัฒนา', 'ชำนาญ', 'เชี่ยวชาญ'],
        datasets: [{
          data: dataValues,
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Prompt', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val.toLocaleString()} คน (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  renderGradeChart(gradeCountMap) {
    const ctx = document.getElementById('chart-grades');
    if (!ctx) return;

    if (this.chartGrade) {
      this.chartGrade.destroy();
    }

    if (typeof Chart === 'undefined') return;

    const labels = Object.keys(gradeCountMap);
    const data = Object.values(gradeCountMap);

    this.chartGrade = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['ยังไม่มีข้อมูล'],
        datasets: [{
          label: 'จำนวนบันทึก (รายการ)',
          data: data.length ? data : [0],
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  renderRecentTable(recentRecords) {
    const tbody = document.getElementById('table-recent-records');
    if (!tbody) return;

    const currentUser = window.storageMgr.getCurrentUser();

    if (!recentRecords.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-6 text-slate-400">ยังไม่มีประวัติการบันทึก</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recentRecords.map(r => {
      const statusBadge = this.getStatusBadge(r);
      const actionBtns = this.getActionButtons(r, currentUser);

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
          <td class="py-3 px-4 font-medium text-slate-800">${formatThaiDate(r.date, 'short')}</td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800">${r.topic}</div>
            <div class="text-xs text-slate-500">ภาคเรียนที่ ${r.semester || '1'}/${r.academicYear || '2567'} | แผนที่ ${r.planNo || '-'} | ${r.subject || ''} | ${r.hours || ''}</div>
          </td>
          <td class="py-3 px-4"><span class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">${r.grade}</span></td>
          <td class="py-3 px-4 text-slate-600 text-sm">${r.teacherName}</td>
          <td class="py-3 px-4 text-center">${statusBadge}</td>
          <td class="py-3 px-4 text-right">${actionBtns}</td>
        </tr>
      `;
    }).join('');
  }

  getStatusBadge(record) {
    const isAcademicDone = window.storageMgr.isAcademicReviewed(record);
    const isDirectorDone = window.storageMgr.isDirectorReviewed(record);

    const academicBadge = isAcademicDone
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">✅ วิชาการ: ตรวจแล้ว</span>`
      : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">⏳ วิชาการ: ยังไม่ตรวจ</span>`;

    let directorBadge = '';
    if (isDirectorDone) {
      directorBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">✅ ผอ.: อนุมัติแล้ว</span>`;
    } else if (!isAcademicDone) {
      directorBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200" title="ต้องผ่านการตรวจของหัวหน้ากลุ่มบริหารวิชาการก่อน">🔒 ผอ.: รอวิชาการตรวจก่อน</span>`;
    } else {
      directorBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">⏳ ผอ.: ยังไม่ตรวจ</span>`;
    }

    // การติดตามผลของครูผู้สอนหลังตรวจอนุมัติ (เข้ามาดูหรือยัง / กดสั่งพิมพ์หรือยัง)
    let teacherEngagementHtml = '';
    if (isAcademicDone || isDirectorDone) {
      const viewedBadge = record.teacherViewedAfterApproval
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200" title="ครูเปิดดูเอกสารแล้วเมื่อ ${record.teacherViewedAt ? formatThaiDate(record.teacherViewedAt, 'short') : '-'}">👁️ ครูเข้ามาดูแล้ว</span>`
        : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200" title="ครูยังไม่ได้เข้ามาเปิดดูเอกสารหลังการอนุมัติ">💤 ครูยังไม่เข้ามาดู</span>`;

      const printedBadge = record.teacherPrintedAt
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200" title="ครูกดพิมพ์เมื่อ ${formatThaiDate(record.teacherPrintedAt, 'short')} รวม ${record.teacherPrintCount || 1} ครั้ง">🖨️ กดพิมพ์แล้ว (${record.teacherPrintCount || 1} ครั้ง)</span>`
        : `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200" title="ครูยังไม่ได้กดสั่งพิมพ์หรือบันทึกเป็น PDF">📄 ยังไม่กดพิมพ์</span>`;

      teacherEngagementHtml = `
        <div class="mt-1.5 pt-1.5 border-t border-slate-200/70 flex flex-col gap-1 w-full">
          <div class="text-[9.5px] text-slate-500 font-bold">การติดตามครู:</div>
          <div class="flex flex-wrap gap-1">
            ${viewedBadge}
            ${printedBadge}
          </div>
        </div>
      `;
    }

    return `
      <div class="flex flex-col gap-1 items-start">
        ${academicBadge}
        ${directorBadge}
        ${teacherEngagementHtml}
      </div>
    `;
  }

  getActionButtons(r, currentUser) {
    let btns = `
      <button onclick="window.printMgr.openPreview('${r.id}')" class="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md font-medium transition mr-1" title="พิมพ์ 1 หน้า A4 / PDF">
        🖨️ พิมพ์/PDF
      </button>
    `;

    // ปุ่มตรวจสำหรับวิชาการ
    if (currentUser?.role === 'academic') {
      btns += `
        <button onclick="window.app.openReviewModal('${r.id}', 'academic')" class="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md font-medium transition mr-1 border border-purple-200">
          ✍️ ตรวจ/ลงนาม
        </button>
      `;
    }

    // ปุ่มตรวจสำหรับ ผอ. (ต้องผ่านวิชาการตรวจก่อนเสมอ)
    if (currentUser?.role === 'director') {
      const isAcademicDone = window.storageMgr.isAcademicReviewed(r);
      if (isAcademicDone) {
        btns += `
          <button onclick="window.app.openReviewModal('${r.id}', 'director')" class="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-medium transition mr-1 border border-emerald-200">
            ✍️ ตรวจ/อนุมัติ
          </button>
        `;
      } else {
        btns += `
          <button disabled class="px-2 py-1 text-xs bg-slate-100 text-slate-400 rounded-md font-medium cursor-not-allowed border border-slate-200 opacity-60 mr-1" title="ต้องผ่านการตรวจของหัวหน้ากลุ่มบริหารวิชาการก่อน">
            🔒 ผอ. รอวิชาการตรวจ
          </button>
        `;
      }
    }

    // แก้ไข (เฉพาะเจ้าของบันทึก หรือ แอดมิน)
    if (currentUser?.role === 'admin' || currentUser?.id === r.teacherId || currentUser?.username === r.teacherUsername) {
      btns += `
        <button onclick="window.formMgr.loadForEdit('${r.id}')" class="px-2 py-1 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-medium transition mr-1">
          ✏️ แก้ไข
        </button>
      `;
    }

    // ลบ (เฉพาะแอดมิน หรือ เจ้าของ)
    if (currentUser?.role === 'admin' || currentUser?.id === r.teacherId) {
      btns += `
        <button onclick="window.app.confirmDeleteRecord('${r.id}')" class="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-md font-medium transition">
          🗑️
        </button>
      `;
    }

    return btns;
  }

  setupFilters() {
    const searchInput = document.getElementById('history-search');
    const teacherFilter = document.getElementById('history-filter-teacher');
    const gradeFilter = document.getElementById('history-filter-grade');

    if (searchInput) searchInput.addEventListener('input', () => this.renderHistoryTable());
    if (teacherFilter) teacherFilter.addEventListener('change', () => this.renderHistoryTable());
    if (gradeFilter) gradeFilter.addEventListener('change', () => this.renderHistoryTable());

    // ปุ่มเลือกกรองสถานะตรวจ (ทั้งหมด / ยังไม่ตรวจ / ตรวจแล้ว)
    document.querySelectorAll('.btn-filter-status').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentStatusFilter = btn.dataset.filterStatus || 'all';
        document.querySelectorAll('.btn-filter-status').forEach(b => {
          if (b === btn) {
            b.className = 'btn-filter-status bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition';
          } else {
            b.className = 'btn-filter-status bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition';
          }
        });
        this.renderHistoryTable();
      });
    });

    // ปุ่มเปิดหน้าต่างติดตามความถี่การส่งบันทึกของครู
    const btnFreq = document.getElementById('btn-open-frequency-modal');
    if (btnFreq) {
      btnFreq.addEventListener('click', () => this.openFrequencyModal());
    }
    const btnFreqDash = document.getElementById('btn-open-frequency-modal-dash');
    if (btnFreqDash) {
      btnFreqDash.addEventListener('click', () => this.openFrequencyModal());
    }
  }

  updateFilterDropdowns() {
    const records = this.getFilteredRecordsForCurrentUser();
    const teachers = window.storageMgr.getTeachers();
    const currentUser = window.storageMgr.getCurrentUser();

    const teacherSelect = document.getElementById('history-filter-teacher');
    if (teacherSelect) {
      if (currentUser?.role === 'teacher') {
        teacherSelect.parentElement.classList.add('hidden');
      } else {
        teacherSelect.parentElement.classList.remove('hidden');
        const current = teacherSelect.value;
        teacherSelect.innerHTML = '<option value="">ครูผู้สอนทั้งหมด</option>';
        teachers.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.name;
          opt.textContent = t.name;
          if (t.name === current) opt.selected = true;
          teacherSelect.appendChild(opt);
        });
      }
    }

    const gradeSelect = document.getElementById('history-filter-grade');
    if (gradeSelect) {
      const current = gradeSelect.value;
      const grades = Array.from(new Set(records.map(r => r.grade).filter(Boolean)));
      gradeSelect.innerHTML = '<option value="">ระดับชั้นทั้งหมด</option>';
      grades.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        if (g === current) opt.selected = true;
        gradeSelect.appendChild(opt);
      });
    }
  }

  renderHistoryTable() {
    const tbody = document.getElementById('table-history-records');
    if (!tbody) return;

    let records = this.getFilteredRecordsForCurrentUser();
    const currentUser = window.storageMgr.getCurrentUser();

    // 1. คำนวณจำนวนสถานะตรวจสำหรับปุ่ม Quick Filter (ตามบทบาทผู้ใช้)
    let countAll = records.length;
    let countPending = 0;
    let countApproved = 0;

    records.forEach(r => {
      let isPending = false;
      let isDone = false;
      if (currentUser?.role === 'academic') {
        isDone = window.storageMgr.isAcademicReviewed(r);
        isPending = !isDone;
      } else if (currentUser?.role === 'director') {
        isDone = window.storageMgr.isDirectorReviewed(r);
        isPending = !isDone;
      } else {
        isDone = window.storageMgr.isAcademicReviewed(r) && window.storageMgr.isDirectorReviewed(r);
        isPending = !isDone;
      }
      if (isPending) countPending++;
      if (isDone) countApproved++;
    });

    const elCountAll = document.getElementById('status-count-all');
    const elCountPending = document.getElementById('status-count-pending');
    const elCountApproved = document.getElementById('status-count-approved');
    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountPending) elCountPending.textContent = countPending;
    if (elCountApproved) elCountApproved.textContent = countApproved;

    // 2. กรองตามปุ่มสถานะตรวจ (Quick Filter)
    if (this.currentStatusFilter === 'pending') {
      if (currentUser?.role === 'academic') {
        records = records.filter(r => !window.storageMgr.isAcademicReviewed(r));
      } else if (currentUser?.role === 'director') {
        records = records.filter(r => !window.storageMgr.isDirectorReviewed(r));
      } else {
        records = records.filter(r => !window.storageMgr.isAcademicReviewed(r) || !window.storageMgr.isDirectorReviewed(r));
      }
    } else if (this.currentStatusFilter === 'approved') {
      if (currentUser?.role === 'academic') {
        records = records.filter(r => window.storageMgr.isAcademicReviewed(r));
      } else if (currentUser?.role === 'director') {
        records = records.filter(r => window.storageMgr.isDirectorReviewed(r));
      } else {
        records = records.filter(r => window.storageMgr.isAcademicReviewed(r) && window.storageMgr.isDirectorReviewed(r));
      }
    }

    // 3. กรองตามคำค้นหา ครูผู้สอน และระดับชั้น
    const searchTerm = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    const teacherTerm = document.getElementById('history-filter-teacher')?.value || '';
    const gradeTerm = document.getElementById('history-filter-grade')?.value || '';

    if (searchTerm) {
      records = records.filter(r => 
        (r.topic && r.topic.toLowerCase().includes(searchTerm)) ||
        (r.grade && r.grade.toLowerCase().includes(searchTerm)) ||
        (r.subject && r.subject.toLowerCase().includes(searchTerm)) ||
        (r.teacherName && r.teacherName.toLowerCase().includes(searchTerm))
      );
    }

    if (teacherTerm && currentUser?.role !== 'teacher') {
      records = records.filter(r => r.teacherName === teacherTerm);
    }

    if (gradeTerm) {
      records = records.filter(r => r.grade === gradeTerm);
    }

    const countLabel = document.getElementById('history-count-label');
    if (countLabel) countLabel.textContent = `พบ ${records.length} รายการ`;

    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-10 text-slate-400">
            <div class="text-3xl mb-2">📋</div>
            <div>ไม่พบข้อมูลบันทึกตามเงื่อนไขที่เลือก</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records.map((r, index) => {
      const k = r.knowledge || {};
      const statusBadge = this.getStatusBadge(r);
      const actionBtns = this.getActionButtons(r, currentUser);

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
          <td class="py-3 px-4 text-center text-slate-400 text-xs">${index + 1}</td>
          <td class="py-3 px-4 font-medium text-slate-800 text-sm">${formatThaiDate(r.date, 'short')}</td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800 text-sm">${r.topic}</div>
            <div class="text-xs text-slate-500">ภาคเรียนที่ ${r.semester || '1'}/${r.academicYear || '2567'} | หน่วยที่ ${r.unit || '-'} | แผนที่ ${r.planNo || '-'} | ${r.subject || ''} | ${r.hours || ''}</div>
          </td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">${r.grade}</span>
          </td>
          <td class="py-3 px-4 text-slate-700 text-sm font-medium">
            <div class="font-bold text-slate-900">${r.teacherName}</div>
            <div class="mt-1">${statusBadge}</div>
          </td>
          <td class="py-3 px-4">
            <div class="text-xs text-slate-600 mb-1">รวม ${k.totalStudents || 0} คน</div>
            <div class="w-24 h-2 bg-slate-100 rounded-full flex overflow-hidden">
              <div style="width: ${k.level1Pct || 0}%" class="bg-red-500" title="เริ่มต้น ${k.level1Count} คน"></div>
              <div style="width: ${k.level2Pct || 0}%" class="bg-amber-400" title="พัฒนา ${k.level2Count} คน"></div>
              <div style="width: ${k.level3Pct || 0}%" class="bg-blue-500" title="ชำนาญ ${k.level3Count} คน"></div>
              <div style="width: ${k.level4Pct || 0}%" class="bg-emerald-500" title="เชี่ยวชาญ ${k.level4Count} คน"></div>
            </div>
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            ${actionBtns}
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- ระบบติดตามความถี่และความสม่ำเสมอในการส่งบันทึกหลังสอนของครู ---
  openFrequencyModal() {
    const modal = document.getElementById('modal-teacher-frequency');
    if (!modal) return;
    this.renderTeacherFrequencyReport();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeFrequencyModal() {
    const modal = document.getElementById('modal-teacher-frequency');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }

  renderTeacherFrequencyReport() {
    const tbody = document.getElementById('table-teacher-frequency-body');
    if (!tbody) return;

    const teachers = window.storageMgr.getTeachers();
    const allRecords = window.storageMgr.getRecords();

    let countGood = 0;
    let countWarn = 0;
    let countDanger = 0;

    const rows = teachers.map((teacher, idx) => {
      // ค้นหาบันทึกของครูท่านนี้ทั้งหมด
      const teacherRecords = allRecords.filter(r => 
        r.teacherId === teacher.id || 
        r.teacherUsername === teacher.username || 
        r.teacherName === teacher.name
      );

      // เรียงลำดับจากวันที่ล่าสุดไปเก่าสุด
      teacherRecords.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

      const totalCount = teacherRecords.length;
      const latestRecord = teacherRecords[0] || null;

      let latestDateStr = '-';
      let latestTopicStr = '<span class="text-slate-400">-</span>';
      let statusBadge = '';

      if (!latestRecord) {
        countDanger++;
        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">🔴 ยังไม่เคยส่งบันทึก</span>`;
      } else {
        latestDateStr = formatThaiDate(latestRecord.date, 'short');
        latestTopicStr = `<b>${latestRecord.topic || '-'}</b><div class="text-[11px] text-slate-500">${latestRecord.grade || ''} | ${latestRecord.subject || ''}</div>`;

        // คำนวณจำนวนวันที่ผ่านมา (เปรียบเทียบเฉพาะวัน Calendar days)
        const dRec = new Date(latestRecord.date || latestRecord.createdAt);
        const dNow = new Date();
        dRec.setHours(0, 0, 0, 0);
        dNow.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((dNow - dRec) / (1000 * 60 * 60 * 24)));

        if (diffDays === 0) {
          countGood++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 ส่งล่าสุดเมื่อวันนี้</span>`;
        } else if (diffDays === 1) {
          countGood++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 ส่งล่าสุดเมื่อ 1 วันที่แล้ว</span>`;
        } else if (diffDays === 2) {
          countGood++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 ส่งล่าสุดเมื่อ 2 วันที่แล้ว</span>`;
        } else if (diffDays === 3) {
          countWarn++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">🟡 ส่งล่าสุดเมื่อ 3 วันที่แล้ว</span>`;
        } else if (diffDays === 4) {
          countWarn++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">🟡 ส่งล่าสุดเมื่อ 4 วันที่แล้ว</span>`;
        } else if (diffDays === 5) {
          countDanger++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">🔴 ส่งล่าสุดเมื่อ 5 วันที่แล้ว</span>`;
        } else if (diffDays < 7) {
          countDanger++;
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">🔴 ส่งล่าสุดเมื่อ ${diffDays} วันที่แล้ว</span>`;
        } else if (diffDays < 30) {
          countDanger++;
          const weeks = Math.floor(diffDays / 7);
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">🔴 ส่งล่าสุดเมื่อ ${weeks} สัปดาห์ที่แล้ว</span>`;
        } else {
          countDanger++;
          const months = Math.floor(diffDays / 30);
          statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">🔴 ส่งล่าสุดเมื่อ ${months} เดือนที่แล้ว</span>`;
        }
      }

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
          <td class="py-3 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
          <td class="py-3 px-3">
            <div class="font-bold text-slate-900">${teacher.name}</div>
            <div class="text-[11px] text-slate-500">${teacher.position || 'ครู'} | ${teacher.subjectGroup || '-'}</div>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs">
              ${totalCount} แผน
            </span>
          </td>
          <td class="py-3 px-3">${latestTopicStr}</td>
          <td class="py-3 px-3 text-slate-700 font-medium">${latestDateStr}</td>
          <td class="py-3 px-3 text-center">${statusBadge}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;

    const elTotal = document.getElementById('freq-total-teachers');
    const elGood = document.getElementById('freq-count-good');
    const elWarn = document.getElementById('freq-count-warn');
    const elDanger = document.getElementById('freq-count-danger');

    if (elTotal) elTotal.textContent = `${teachers.length} ท่าน`;
    if (elGood) elGood.textContent = `${countGood} ท่าน`;
    if (elWarn) elWarn.textContent = `${countWarn} ท่าน`;
    if (elDanger) elDanger.textContent = `${countDanger} ท่าน`;
  }
}

window.dashboardMgr = new DashboardManager();
