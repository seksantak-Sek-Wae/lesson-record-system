/**
 * print.js - จัดการการแสดงผลตัวอย่างเอกสารราชการไทย ขนาด 1 หน้า A4 พอดี
 * ปรับปรุงขนาดฟอนต์ ไม่ให้ตัวหนังสือทับซ้อน พร้อมรูปภาพกิจกรรม 2 รูป และรูปถ่ายครู
 */

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function formatThaiDate(dateStr, formatType = 'full') {
  if (!dateStr) return '..........................................';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10) + 543;
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (formatType === 'full') {
      return `${day} ${THAI_MONTHS[month]} พ.ศ. ${year}`;
    } else if (formatType === 'short') {
      return `${day}/${month + 1}/${year}`;
    } else {
      return `${day} ${THAI_MONTHS[month]} ${year}`;
    }
  } catch (e) {
    return dateStr;
  }
}

function renderPrintDocument(record, settings, sigToggles = {}) {
  const k = record.knowledge || {
    totalStudents: 0,
    level1Count: 0, level1Pct: 0,
    level2Count: 0, level2Pct: 0,
    level3Count: 0, level3Pct: 0,
    level4Count: 0, level4Pct: 0
  };

  const logoHtml = settings.logo
    ? `<div style="text-align: center; margin-bottom: 2px;">
         <img src="${settings.logo}" alt="Logo โรงเรียน" style="height: 38px; object-fit: contain; max-width: 90px;" />
       </div>`
    : '';

  // ตรวจสอบรูปลายเซ็นและบัญชีผู้ใช้
  const teacherAccount = (record.teacherId ? window.storageMgr.getAccountById(record.teacherId) : null) || 
                         window.storageMgr.getAccountByUsername(record.teacherUsername || '');
  const academicAcc = window.storageMgr.getAcademicHeadAccount();
  const directorAcc = window.storageMgr.getDirectorAccount();

  // ตัวเลือกว่าจะให้แสดงลายเซ็นของแต่ละฝ่ายหรือไม่
  const showTeacher = sigToggles.teacher !== undefined ? sigToggles.teacher : (record.showTeacherSig !== false);
  const showAcademic = sigToggles.academic !== undefined ? sigToggles.academic : (record.showAcademicSig !== false);
  const showDirector = sigToggles.director !== undefined ? sigToggles.director : (record.showDirectorSig !== false);

  // 1. ลายเซ็นครูผู้สอน
  let teacherSig = null;
  if (showTeacher) {
    if (record.teacherSignature === '') {
      teacherSig = null; // ลบออก
    } else if (record.teacherSignature) {
      teacherSig = record.teacherSignature;
    } else {
      teacherSig = teacherAccount?.signatureImg || null;
    }
  }

  // 2. ลายเซ็นหัวหน้าวิชาการ: หาก record.academicSignature เป็น '' (ลบออกแล้ว) จะต้องไม่มีรูปลายเซ็นประทับลงในเอกสารเด็ดขาด!
  let academicSig = null;
  if (showAcademic && record.academicStatus === 'approved') {
    if (record.academicSignature === '') {
      academicSig = null; // ลบออกชัดเจน ไม่ดึง fallback บัญชีมาซ้ำ
    } else if (record.academicSignature) {
      academicSig = record.academicSignature;
    } else if (record.academicSignature === undefined) {
      academicSig = academicAcc?.signatureImg || null;
    }
  }

  // 3. ลายเซ็นผู้อำนวยการ: หาก record.directorSignature เป็น '' (ลบออกแล้ว) จะต้องไม่มีรูปลายเซ็นประทับลงในเอกสารเด็ดขาด!
  let directorSig = null;
  if (showDirector && record.directorStatus === 'approved') {
    if (record.directorSignature === '') {
      directorSig = null; // ลบออกชัดเจน ไม่ดึง fallback บัญชีมาซ้ำ
    } else if (record.directorSignature) {
      directorSig = record.directorSignature;
    } else if (record.directorSignature === undefined) {
      directorSig = directorAcc?.signatureImg || null;
    }
  }

  // ปรับขนาดรูปลายเซ็นให้ใหญ่พอเหมาะ ชัดเจน สง่างาม ไม่เล็ก (ความสูง 52px กว้างไม่เกิน 140px)
  const teacherSigHtml = teacherSig
    ? `<img src="${teacherSig}" alt="ลายเซ็นครู" style="height: 52px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" />`
    : `<div style="height: 52px; width: 100%;"></div>`;

  const academicSigHtml = academicSig
    ? `<img src="${academicSig}" alt="ลายเซ็นวิชาการ" style="height: 52px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" />`
    : `<div style="height: 52px; width: 100%;"></div>`;

  const directorSigHtml = directorSig
    ? `<img src="${directorSig}" alt="ลายเซ็นผู้อำนวยการ" style="height: 52px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" />`
    : `<div style="height: 52px; width: 100%;"></div>`;

  // ภาพกิจกรรมการเรียนการสอน (จำนวน 2 รูป) ปรับเลย์เอาต์สัดส่วน 4*3
  let photosHtml = '';
  if (record.activityPhoto1 || record.activityPhoto2) {
    photosHtml = `
      <div style="margin-top: 6px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 5px; padding: 6px 8px;">
        <div style="font-weight: bold; font-size: 9.5pt; color: #1e293b; margin-bottom: 5px;">
          ภาพการจัดกิจกรรมการเรียนการสอน (จำนวน 2 รูป สัดส่วน 4:3):
        </div>
        <div style="display: flex; gap: 14px; justify-content: center; align-items: stretch;">
          <div style="flex: 1; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
            <div style="width: 100%; display: flex; justify-content: center; align-items: center;">
              ${record.activityPhoto1 ? `
                <img src="${record.activityPhoto1}" alt="ภาพบรรยากาศการจัดกิจกรรมการเรียนรู้" style="width: 100%; max-width: 200px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 3px; display: block; border: 1px solid #cbd5e1;" />
              ` : `
                <div style="width: 100%; max-width: 200px; aspect-ratio: 4 / 3; border: 1px dashed #cbd5e1; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 8.5pt; background: #ffffff;">
                  <span style="font-size: 22px;">🖼️</span>
                  <span style="margin-top: 4px;">ภาพบรรยากาศการสอน (4:3)</span>
                </div>
              `}
            </div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 4px; font-weight: 500;">ภาพที่ 1: บรรยากาศการจัดกิจกรรมการเรียนรู้</div>
          </div>
          <div style="flex: 1; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
            <div style="width: 100%; display: flex; justify-content: center; align-items: center;">
              ${record.activityPhoto2 ? `
                <img src="${record.activityPhoto2}" alt="ภาพผลงานและกิจกรรมของผู้เรียน" style="width: 100%; max-width: 200px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 3px; display: block; border: 1px solid #cbd5e1;" />
              ` : `
                <div style="width: 100%; max-width: 200px; aspect-ratio: 4 / 3; border: 1px dashed #cbd5e1; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 8.5pt; background: #ffffff;">
                  <span style="font-size: 22px;">🖼️</span>
                  <span style="margin-top: 4px;">ภาพผลงาน/กิจกรรมผู้เรียน (4:3)</span>
                </div>
              `}
            </div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 4px; font-weight: 500;">ภาพที่ 2: ผลงาน / กิจกรรมของผู้เรียน</div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="print-page print-document" id="printable-area">
      ${logoHtml}

      <!-- ส่วนหัวเอกสารโรงเรียน -->
      <div style="text-align: center; margin-bottom: 4px; line-height: 1.45;">
        <div style="font-size: 13pt; font-weight: bold; color: #000;">${settings.schoolName || 'โรงเรียน................................................'}</div>
        <div style="font-size: 9.5pt; color: #334155; margin-top: 1px;">${settings.schoolAddress || ''}</div>
      </div>

      <!-- หัวเรื่องหลัก -->
      <div style="text-align: center; margin-bottom: 6px; line-height: 1.4;">
        <span style="font-size: 13pt; font-weight: bold; text-decoration: underline;">บันทึกหลังกิจกรรมการจัดการเรียนรู้</span>
      </div>

      <!-- ข้อมูลแผนและบทเรียน (ระยะบรรทัด 1.55 สะอาด ชัดเจน ไม่ทับซ้อน) -->
      <div style="margin-bottom: 6px; line-height: 1.55; font-size: 10pt; background: #f8fafc; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 5px;">
        <div style="margin-bottom: 2px;">
          ภาคเรียนที่ <span class="fill-text">${record.semester || '1'}</span>
          &nbsp;ปีการศึกษา <span class="fill-text">${record.academicYear || '2567'}</span>
          &nbsp;|&nbsp; วันที่ <span class="fill-text">${formatThaiDate(record.date, 'full')}</span>
          &nbsp;|&nbsp; หน่วยที่ <span class="fill-text">${record.unit || '-'}</span>
          &nbsp;|&nbsp; แผนที่ <span class="fill-text">${record.planNo || '-'}</span>
        </div>
        <div>
          เรื่อง <span class="fill-text">${record.topic || '-'}</span>
          &nbsp;|&nbsp; ${record.grade ? (record.grade.startsWith('ชั้น') ? `<span class="fill-text">${record.grade}</span>` : `ระดับชั้น <span class="fill-text">${record.grade}</span>`) : 'ระดับชั้น -'}
          ${record.subject ? `&nbsp;|&nbsp; วิชา <span class="fill-text">${record.subject}</span>` : ''}
          ${record.hours ? `&nbsp;|&nbsp; เวลา <span class="fill-text">${record.hours}</span>` : ''}
          &nbsp;|&nbsp; ผู้สอน <span class="fill-text">${record.teacherName || '-'}</span>
        </div>
      </div>

      <!-- 1. ด้านความรู้ (4 ระดับ) -->
      <div style="margin-top: 4px; font-size: 10pt; line-height: 1.45;">
        <div style="font-weight: bold; margin-bottom: 4px;">
          ผลการจัดการเรียนการสอน (ด้านความรู้): 
          <span style="font-weight: normal;">มีนักเรียนทั้งหมด <span class="fill-text">${k.totalStudents || 0}</span> คน เมื่อวัดผลประเมินผลแล้วมีนักเรียน:</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; text-align: center; margin-bottom: 6px; line-height: 1.4;">
          <thead>
            <tr style="background: #f1f5f9; border: 1px solid #475569;">
              <th style="border: 1px solid #475569; padding: 3px 5px; font-weight: bold;">ระดับคุณภาพ</th>
              <th style="border: 1px solid #475569; padding: 3px 5px; width: 22%;">1. ระดับเริ่มต้น</th>
              <th style="border: 1px solid #475569; padding: 3px 5px; width: 22%;">2. ระดับพัฒนา</th>
              <th style="border: 1px solid #475569; padding: 3px 5px; width: 22%;">3. ระดับชำนาญ</th>
              <th style="border: 1px solid #475569; padding: 3px 5px; width: 22%;">4. ระดับเชี่ยวชาญ</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border: 1px solid #475569;">
              <td style="border: 1px solid #475569; padding: 3px 5px; font-weight: bold; background: #ffffff;">จำนวน (คน)</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${k.level1Count || 0}</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${k.level2Count || 0}</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${k.level3Count || 0}</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${k.level4Count || 0}</td>
            </tr>
            <tr style="border: 1px solid #475569;">
              <td style="border: 1px solid #475569; padding: 3px 5px; font-weight: bold; background: #ffffff;">คิดเป็นร้อยละ</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${Number(k.level1Pct || 0).toFixed(2)}%</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${Number(k.level2Pct || 0).toFixed(2)}%</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${Number(k.level3Pct || 0).toFixed(2)}%</td>
              <td style="border: 1px solid #475569; padding: 3px 5px;">${Number(k.level4Pct || 0).toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2. ด้านทักษะ (P) และ ด้านเจตคติ (A) (ฟอนต์ 9.5pt ระยะบรรทัด 1.5) -->
      <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 9.5pt; line-height: 1.5;">
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; min-height: 44px; background: #ffffff;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">ด้านทักษะ</div>
          <div style="text-indent: 12px; color: #1e293b; line-height: 1.5;">
            ${record.skill ? record.skill.replace(/\n/g, '<br>') : '-'}
          </div>
        </div>
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; min-height: 44px; background: #ffffff;">
          <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">ด้านเจตคติ</div>
          <div style="text-indent: 12px; color: #1e293b; line-height: 1.5;">
            ${record.attitude ? record.attitude.replace(/\n/g, '<br>') : '-'}
          </div>
        </div>
      </div>

      <!-- 3. ปัญหา/อุปสรรค และ แนวทางการแก้ไข (ฟอนต์ 9.5pt ระยะบรรทัด 1.5) -->
      <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 9.5pt; line-height: 1.5;">
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; min-height: 44px; background: #ffffff;">
          <div style="font-weight: bold; margin-bottom: 2px;">ปัญหา/อุปสรรคจากการสอน</div>
          <div style="text-indent: 12px; color: #1e293b; line-height: 1.5;">
            ${record.problem ? record.problem.replace(/\n/g, '<br>') : '-'}
          </div>
        </div>
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 4px; min-height: 44px; background: #ffffff;">
          <div style="font-weight: bold; margin-bottom: 2px;">แนวทางการแก้ไข</div>
          <div style="text-indent: 12px; color: #1e293b; line-height: 1.5;">
            ${record.solution ? record.solution.replace(/\n/g, '<br>') : '-'}
          </div>
        </div>
      </div>

      <!-- ภาพกิจกรรมการเรียนการสอน (ถ้ามี) ขยายใหญ่เต็มความกว้างหน้ากระดาษ -->
      ${photosHtml}

      <!-- 4. ส่วนการลงนาม 3 ฝ่าย (3 คอลัมน์ด้านล่างสุด ขนาดฟอนต์ 9pt ระยะบรรทัด 1.4 ไม่มีรูปถ่ายครู) -->
      <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px dashed #64748b; padding-top: 6px; font-size: 9pt; line-height: 1.4;">
        
        <!-- คอลัมน์ 1: ครูผู้สอน (ไม่มีรูปใบหน้าครู พื้นที่ลงชื่อกว้าง ไม่มีข้อความ ลงชื่อ ....) -->
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 7px 5px; border-radius: 4px; text-align: center; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; min-height: 146px;">
          <div>
            <div style="font-weight: bold; margin-bottom: 2px; font-size: 9.5pt; color: #000;">ครูผู้สอน</div>
            <div style="font-size: 8.5pt; color: #475569; min-height: 18px; padding: 1px 2px; line-height: 1.35;">
              บันทึกและรายงานผล
            </div>
          </div>
          <div style="height: 52px; min-height: 52px; display: flex; align-items: center; justify-content: center; margin: 3px 0;">
            ${teacherSigHtml}
          </div>
          <div>
            <div style="font-size: 9.5pt;">( <span class="fill-text">${record.teacherName || '................................'}</span> )</div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 1px;">ตำแหน่ง ${record.teacherPosition || 'ครูผู้สอน'}</div>
            <div style="margin-top: 2px; font-size: 8.5pt;">วันที่ <span class="fill-text">${formatThaiDate(record.teacherSignDate || record.date, 'short')}</span></div>
          </div>
        </div>

        <!-- คอลัมน์ 2: หัวหน้ากลุ่มบริหารงานวิชาการ -->
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 7px 5px; border-radius: 4px; text-align: center; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; min-height: 146px;">
          <div>
            <div style="font-weight: bold; margin-bottom: 2px; font-size: 9.5pt; color: #000;">หัวหน้ากลุ่มบริหารงานวิชาการ</div>
            <div style="font-size: 8.5pt; text-align: center; min-height: 18px; padding: 1px 2px; color: #222; line-height: 1.35;">
              ${record.academicComment ? `ความเห็น: ${record.academicComment}` : 'ความเห็น: ทราบและเห็นชอบ'}
            </div>
          </div>
          <div style="height: 52px; min-height: 52px; display: flex; align-items: center; justify-content: center; margin: 3px 0;">
            ${academicSigHtml}
          </div>
          <div>
            <div style="font-size: 9.5pt;">( <span class="fill-text">${settings.academicHead || '................................'}</span> )</div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 1px;">${settings.academicHeadTitle || 'หัวหน้ากลุ่มบริหารงานวิชาการ'}</div>
            <div style="margin-top: 2px; font-size: 8.5pt;">วันที่ <span class="fill-text">${formatThaiDate(record.academicSignDate || record.date, 'short')}</span></div>
          </div>
        </div>

        <!-- คอลัมน์ 3: ผู้อำนวยการโรงเรียน -->
        <div style="flex: 1; border: 1px solid #cbd5e1; padding: 7px 5px; border-radius: 4px; text-align: center; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; min-height: 146px;">
          <div>
            <div style="font-weight: bold; margin-bottom: 2px; font-size: 9.5pt; color: #000;">ผู้อำนวยการโรงเรียน</div>
            <div style="font-size: 8.5pt; text-align: center; min-height: 18px; padding: 1px 2px; color: #222; line-height: 1.35;">
              ${record.directorComment ? `ความเห็น: ${record.directorComment}` : 'ความเห็น: ทราบและเห็นชอบ'}
            </div>
          </div>
          <div style="height: 52px; min-height: 52px; display: flex; align-items: center; justify-content: center; margin: 3px 0;">
            ${directorSigHtml}
          </div>
          <div>
            <div style="font-size: 9.5pt;">( <span class="fill-text">${settings.directorName || '................................'}</span> )</div>
            <div style="font-size: 8.5pt; color: #475569; margin-top: 1px;">${settings.directorTitle || 'ผู้อำนวยการโรงเรียน'}</div>
            <div style="margin-top: 2px; font-size: 8.5pt;">วันที่ <span class="fill-text">${formatThaiDate(record.directorSignDate || record.date, 'short')}</span></div>
          </div>
        </div>

      </div>

    </div>
  `;

  return html;
}

class PrintManager {
  constructor() {
    this.currentRecord = null;
    this.modal = null;
    this.container = null;
    this.sigToggles = {
      teacher: true,
      academic: true,
      director: true
    };
  }

  init() {
    this.modal = document.getElementById('print-preview-modal');
    this.container = document.getElementById('print-document-container');

    const btnPrint = document.getElementById('btn-do-print');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        // บันทึกสถานะว่าครูผู้สอนได้กดสั่งพิมพ์แล้ว
        if (this.currentRecord && window.storageMgr) {
          const currentUser = window.storageMgr.getCurrentUser();
          if (currentUser && (currentUser.role === 'teacher' || currentUser.id === this.currentRecord.teacherId)) {
            const printCount = (this.currentRecord.teacherPrintCount || 0) + 1;
            const printDate = new Date().toISOString();
            this.currentRecord.teacherPrintedAt = printDate;
            this.currentRecord.teacherPrintCount = printCount;
            window.storageMgr.updateRecord(this.currentRecord.id, {
              teacherPrintedAt: printDate,
              teacherPrintCount: printCount
            });
            if (window.dashboardMgr) {
              window.dashboardMgr.renderHistoryTable();
            }
          }
        }
        window.print();
      });
    }

    const btnClose = document.getElementById('btn-close-print-modal');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.closePreview();
      });
    }

    // แถบสวิตช์เลือกแสดง/ซ่อนลายเซ็นทั้ง 3 ฝ่ายในเอกสาร A4
    const toggleTeacher = document.getElementById('print-toggle-sig-teacher');
    const toggleAcademic = document.getElementById('print-toggle-sig-academic');
    const toggleDirector = document.getElementById('print-toggle-sig-director');

    [
      { el: toggleTeacher, key: 'teacher' },
      { el: toggleAcademic, key: 'academic' },
      { el: toggleDirector, key: 'director' }
    ].forEach(({ el, key }) => {
      if (el) {
        el.addEventListener('change', () => {
          this.sigToggles[key] = el.checked;
          this.refreshDocument();
        });
      }
    });
  }

  openPreview(recordId) {
    const record = window.storageMgr.getRecordById(recordId);
    if (!record) {
      alert('ไม่พบข้อมูลบันทึกที่ต้องการพิมพ์');
      return;
    }
    this.currentRecord = record;

    // ตรวจสอบและบันทึกว่าครูผู้สอนได้เข้ามาดูหลังตรวจอนุมัติแล้วหรือยัง
    const currentUser = window.storageMgr.getCurrentUser();
    if (currentUser && (currentUser.role === 'teacher' || currentUser.id === record.teacherId || currentUser.username === record.teacherUsername)) {
      const isApproved = window.storageMgr.isAcademicReviewed(record) || window.storageMgr.isDirectorReviewed(record) || record.academicStatus === 'approved' || record.directorStatus === 'approved';
      if (isApproved && !record.teacherViewedAfterApproval) {
        record.teacherViewedAfterApproval = true;
        record.teacherViewedAt = new Date().toISOString();
        window.storageMgr.updateRecord(record.id, {
          teacherViewedAfterApproval: true,
          teacherViewedAt: record.teacherViewedAt
        });
        if (window.dashboardMgr) {
          window.dashboardMgr.renderHistoryTable();
        }
      }
    }

    // ตรวจสอบสถานะเริ่มต้นของลายเซ็นแต่ละฝ่าย
    // หาก record.academicSignature เป็น '' (ถูกลบออก) หรือไม่มี ให้ปิดไว้เป็นค่าเริ่มต้น
    const teacherHasSig = record.showTeacherSig !== false && record.teacherSignature !== '';
    const academicHasSig = record.showAcademicSig !== false && 
                           record.academicSignature !== '' && 
                           (record.academicSignature || record.academicStatus === 'approved');
    const directorHasSig = record.showDirectorSig !== false && 
                           record.directorSignature !== '' && 
                           (record.directorSignature || record.directorStatus === 'approved');

    this.sigToggles = {
      teacher: Boolean(teacherHasSig),
      academic: Boolean(academicHasSig),
      director: Boolean(directorHasSig)
    };

    const toggleTeacher = document.getElementById('print-toggle-sig-teacher');
    const toggleAcademic = document.getElementById('print-toggle-sig-academic');
    const toggleDirector = document.getElementById('print-toggle-sig-director');
    if (toggleTeacher) toggleTeacher.checked = this.sigToggles.teacher;
    if (toggleAcademic) toggleAcademic.checked = this.sigToggles.academic;
    if (toggleDirector) toggleDirector.checked = this.sigToggles.director;

    this.refreshDocument();

    if (this.modal) {
      this.modal.classList.remove('hidden');
    }
    document.body.style.overflow = 'hidden';
  }

  refreshDocument() {
    if (!this.currentRecord || !this.container) return;
    const settings = window.storageMgr.getSettings();
    const docHtml = renderPrintDocument(this.currentRecord, settings, this.sigToggles);
    this.container.innerHTML = docHtml;
  }

  closePreview() {
    if (this.modal) {
      this.modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
  }
}

window.printMgr = new PrintManager();
