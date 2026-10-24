import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService, DashboardData, EdIndicatorDto } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-ugd-case-input',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ugd-case-input.component.html',
  styleUrls: []
})
export class UgdCaseInputComponent implements OnInit, OnDestroy {
  indicatorId = '';
  activeIndicator: EdIndicatorDto | null = null;
  data: DashboardData | null = null;
  loading = true;

  // Form Fields
  hospitalSiteId = '';
  emrNumber = '';
  patientInitials = '';
  caseDate = '';
  doorTimeOnly = '';
  eventTimeOnly = '';
  clinicalNotes = '';

  // Specialized Fields
  painScore = 5;
  medicalDiagnosis = '';
  assessmentTimeOnly = '';
  radiologyAction = '';
  diagnosticExam = '';
  requestTimeOnly = '';
  antibioticName = '';
  prescriptionTimeOnly = '';
  triageLevel = 'Level 2 - Emergent (Kondisi Sangat Kritis)';

  // Edit mode properties
  isEditMode = false;
  caseId: string | null = null;
  loadingCase = false;
  isClosed = false;

  // Live preview & validation states
  previewMinutes: number | null = null;
  previewCompliant = false;
  submitting = false;
  submitError = false;
  submitErrorMessage = '';
  successToast = '';

  private routeSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.caseDate = this.getTodayDateString();
    this.hospitalSiteId = this.dashboardService.getSelectedSiteId() || '';

    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('indicatorId');
      const caseId = params.get('caseId');
      if (id) {
        this.indicatorId = id;
        this.loadIndicatorData();
      }
      if (caseId) {
        this.isEditMode = true;
        this.caseId = caseId;
        this.loadExistingCase(caseId);
      } else {
        this.isEditMode = false;
        this.caseId = null;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadIndicatorData(): void {
    this.loading = true;
    this.dashboardService.getDashboardData().subscribe({
      next: (res) => {
        this.data = res;
        this.activeIndicator = res.edIndicators?.find(i => i.id === this.indicatorId) || null;
        if (!this.hospitalSiteId && res.siteCompliance && res.siteCompliance.length > 0) {
          this.hospitalSiteId = res.siteCompliance[0].siteId;
        }
        this.loading = false;
        this.onFormChange();
      },
      error: (err) => {
        console.error('Failed to load dashboard data for case input', err);
        this.loading = false;
      }
    });
  }

  loadExistingCase(caseId: string): void {
    this.loadingCase = true;
    this.dashboardService.getEdSubmissionById(caseId).subscribe({
      next: (sub) => {
        this.loadingCase = false;
        if (!sub) return;
        this.hospitalSiteId = sub.hospitalSiteId || '';
        this.emrNumber = sub.emrNumber || '';
        this.patientInitials = sub.patientInitials || '';
        this.clinicalNotes = sub.clinicalNotes || '';
        this.isClosed = !!sub.isClosed;

        if (sub.doorTime) {
          const door = new Date(sub.doorTime);
          const y = door.getFullYear();
          const m = String(door.getMonth() + 1).padStart(2, '0');
          const d = String(door.getDate()).padStart(2, '0');
          this.caseDate = `${y}-${m}-${d}`;
          this.doorTimeOnly = String(door.getHours()).padStart(2, '0') + ':' + String(door.getMinutes()).padStart(2, '0');
        }
        if (sub.eventTime) {
          const event = new Date(sub.eventTime);
          this.eventTimeOnly = String(event.getHours()).padStart(2, '0') + ':' + String(event.getMinutes()).padStart(2, '0');
        }

        if (sub.customFieldsJson) {
          try {
            const custom = JSON.parse(sub.customFieldsJson);
            if (custom.PainScore !== undefined) this.painScore = Number(custom.PainScore);
            if (custom.MedicalDiagnosis) this.medicalDiagnosis = custom.MedicalDiagnosis;
            if (custom.RadiologyAction) this.radiologyAction = custom.RadiologyAction;
            if (custom.DiagnosticExam) this.diagnosticExam = custom.DiagnosticExam;
            if (custom.AntibioticType) this.antibioticName = custom.AntibioticType;
            if (custom.TriageLevel) this.triageLevel = custom.TriageLevel;

            const extractTime = (val?: string) => {
              if (!val) return '';
              const tIdx = val.indexOf('T');
              if (tIdx !== -1) return val.slice(tIdx + 1, tIdx + 6);
              return val.length >= 5 ? val.slice(0, 5) : '';
            };
            if (custom.AssessmentTime) this.assessmentTimeOnly = extractTime(custom.AssessmentTime);
            if (custom.RequestTime) this.requestTimeOnly = extractTime(custom.RequestTime);
            if (custom.PrescriptionTime) this.prescriptionTimeOnly = extractTime(custom.PrescriptionTime);
          } catch (e) {
            console.error('Error parsing custom fields', e);
          }
        }

        if (sub.isCompliant !== undefined && sub.isCompliant !== null) {
          this.previewCompliant = sub.isCompliant;
        }
        this.onFormChange();
      },
      error: (err) => {
        this.loadingCase = false;
        console.error('Failed to load case data for edit', err);
        this.submitError = true;
        this.submitErrorMessage = 'Gagal memuat rincian data kasus dari server.';
      }
    });
  }

  getIndicatorCode(): string {
    if (this.activeIndicator) {
      const name = this.activeIndicator.name.toLowerCase();
      if (name.includes('ecg') || name.includes('cardio') || name.includes('door-to-ecg')) return 'cardiology';
      if (name.includes('analges') || name.includes('ortho') || name.includes('pain')) return 'orthopaedics';
      if (name.includes('ct') || name.includes('neuro') || name.includes('scan')) return 'neurology';
      if (name.includes('bleed') || name.includes('gastro') || name.includes('cerna')) return 'gastrohepatology';
      if (name.includes('fever') || name.includes('onco') || name.includes('neutropen')) return 'oncology';
      if (name.includes('bidan') || name.includes('maternal') || name.includes('mom')) return 'mom-children';
    }
    const id = this.indicatorId?.toLowerCase() || '';
    if (id === 'a0000000-a000-a000-a000-a00000000000') return 'cardiology';
    if (id === 'a1111111-a111-a111-a111-a111111111111') return 'orthopaedics';
    if (id === 'a2222222-a222-a222-a222-a22222222222') return 'neurology';
    if (id === 'a3333333-a333-a333-a333-a33333333333') return 'gastrohepatology';
    if (id === 'a4444444-a444-a444-a444-a44444444444') return 'oncology';
    if (id === 'a5555555-a555-a555-a555-a55555555555') return 'mom-children';
    return '';
  }

  getTargetMinutes(): number {
    if (this.activeIndicator && this.activeIndicator.targetMinutes) {
      return this.activeIndicator.targetMinutes;
    }
    const code = this.getIndicatorCode();
    switch (code) {
      case 'cardiology': return 10;
      case 'orthopaedics': return 30;
      case 'neurology': return 25;
      case 'gastrohepatology': return 45;
      case 'oncology': return 60;
      case 'mom-children': return 15;
      default: return 10;
    }
  }

  getEventTimeLabel(): string {
    const code = this.getIndicatorCode();
    switch (code) {
      case 'cardiology': return 'Waktu Rekam ECG Selesai & Diinterpretasi';
      case 'orthopaedics': return 'Waktu Pemberian Analgesik Pertama';
      case 'neurology': return 'Waktu Inisiasi CT Scan / MRI';
      case 'gastrohepatology': return 'Waktu Pemeriksaan Diagnostik Dilakukan';
      case 'oncology': return 'Waktu Antibiotik Diberikan ke Pasien';
      case 'mom-children': return 'Waktu Bidan Terlatih Tiba di IGD';
      default: return 'Waktu Tindakan Klinis Selesai';
    }
  }

  getEventTimeShortLabel(): string {
    const code = this.getIndicatorCode();
    switch (code) {
      case 'cardiology': return 'Waktu ECG Selesai';
      case 'orthopaedics': return 'Waktu Analgesik';
      case 'neurology': return 'Waktu CT/MRI Selesai';
      case 'gastrohepatology': return 'Waktu Diagnostik';
      case 'oncology': return 'Waktu Antibiotik IV';
      case 'mom-children': return 'Waktu Bidan Tiba';
      default: return 'Waktu Tindakan';
    }
  }

  getEventTimeHelp(): string {
    const code = this.getIndicatorCode();
    switch (code) {
      case 'cardiology': return 'Standar emas target <= 10 menit sejak pasien tiba di UGD.';
      case 'orthopaedics': return 'Standar pemberian pereda nyeri target <= 30 menit.';
      case 'neurology': return 'Standar door-to-imaging target <= 25 menit.';
      case 'gastrohepatology': return 'Standar inisiasi diagnostik cito target <= 45 menit.';
      case 'oncology': return 'Standar inisiasi antibiotik spektrum luas target <= 60 menit.';
      case 'mom-children': return 'Standar respon bidan jaga target <= 15 menit.';
      default: return 'Waktu pencapaian tindakan definitif.';
    }
  }

  onFormChange(): void {
    if (this.caseDate && this.doorTimeOnly && this.eventTimeOnly) {
      const door = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
      let event = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
      
      if (event < door) {
        event.setDate(event.getDate() + 1); // Melewati pergantian hari tengah malam
      }
      
      const diffMs = event.getTime() - door.getTime();
      const diffMins = diffMs / 1000 / 60;
      this.previewMinutes = Math.round(diffMins * 10) / 10;
      
      const target = this.getTargetMinutes();
      this.previewCompliant = diffMins <= target;
    } else {
      this.previewMinutes = null;
    }
  }

  saveCase(continueInput: boolean): void {
    this.submitError = false;
    this.submitErrorMessage = '';
    this.successToast = '';

    if (!this.hospitalSiteId) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon pilih Rumah Sakit (Hospital Site).';
      return;
    }

    if (!this.emrNumber || !this.caseDate || !this.doorTimeOnly || !this.eventTimeOnly) {
      this.submitError = true;
      this.submitErrorMessage = 'Mohon lengkapi No. Rekam Medis, Tanggal Kasus, Waktu Tiba IGD, dan Waktu Tindakan.';
      return;
    }

    const doorDateTime = new Date(`${this.caseDate}T${this.doorTimeOnly}:00`);
    let eventDateTime = new Date(`${this.caseDate}T${this.eventTimeOnly}:00`);
    if (eventDateTime < doorDateTime) {
      eventDateTime.setDate(eventDateTime.getDate() + 1);
    }

    const diffMs = eventDateTime.getTime() - doorDateTime.getTime();
    const diffMins = diffMs / 1000 / 60;
    const targetLimit = this.getTargetMinutes();
    const isAchieved = diffMins <= targetLimit;

    if (!isAchieved && (!this.clinicalNotes || !this.clinicalNotes.trim())) {
      this.submitError = true;
      this.submitErrorMessage = 'Waktu tindakan melebihi standar target! Mohon wajib isi Keterangan Klinis yang menjelaskan kendala.';
      return;
    }

    const customFieldsObj: any = {};
    const code = this.getIndicatorCode();

    if (code === 'orthopaedics') {
      customFieldsObj.PainScore = this.painScore;
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
    } else if (code === 'neurology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.RadiologyAction = this.radiologyAction || 'CT Scan Kepala Polos (Non-Contrast)';
    } else if (code === 'gastrohepatology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.DiagnosticExam = this.diagnosticExam || 'Endoskopi Saluran Cerna Atas (SCBA)';
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.RequestTime = this.requestTimeOnly ? `${this.caseDate}T${this.requestTimeOnly}:00` : '';
    } else if (code === 'oncology') {
      customFieldsObj.MedicalDiagnosis = this.medicalDiagnosis;
      customFieldsObj.AntibioticType = this.antibioticName;
      customFieldsObj.AssessmentTime = this.assessmentTimeOnly ? `${this.caseDate}T${this.assessmentTimeOnly}:00` : '';
      customFieldsObj.PrescriptionTime = this.prescriptionTimeOnly ? `${this.caseDate}T${this.prescriptionTimeOnly}:00` : '';
    } else if (code === 'mom-children') {
      customFieldsObj.TriageLevel = this.triageLevel;
    }

    const payload = {
      hospitalSiteId: this.hospitalSiteId,
      emrNumber: this.emrNumber.trim(),
      patientInitials: this.patientInitials.trim() || 'XX',
      submissionMonth: this.caseDate.slice(0, 7),
      edIndicatorId: this.indicatorId,
      doorTime: doorDateTime.toISOString(),
      eventTime: eventDateTime.toISOString(),
      clinicalNotes: this.clinicalNotes.trim(),
      customFieldsJson: JSON.stringify(customFieldsObj),
      submittedById: this.authService.currentUser?.id
    };

    if (this.isClosed) {
      this.submitError = true;
      this.submitErrorMessage = 'Periode penginputan kasus ini sudah DITUTUP (locked). Data tidak dapat diedit.';
      return;
    }

    this.submitting = true;

    if (this.isEditMode && this.caseId) {
      this.dashboardService.updateEdCase(this.caseId, payload).subscribe({
        next: () => {
          this.submitting = false;
          const caseMonth = this.caseDate.slice(0, 7);
          const curEnd = this.dashboardService.getFilterEndMonth();
          if (caseMonth > curEnd) {
            this.dashboardService.setDateFilters(this.dashboardService.getFilterStartMonth(), caseMonth);
          }
          this.router.navigate(['/ugd-cases', this.indicatorId]);
        },
        error: (err) => {
          this.submitting = false;
          this.submitError = true;
          this.submitErrorMessage = err.error?.message || (typeof err.error === 'string' ? err.error : 'Gagal memperbarui data kasus di server.');
          console.error('Error updating ED case', err);
        }
      });
      return;
    }

    this.dashboardService.submitEdCase(payload).subscribe({
      next: () => {
        this.submitting = false;
        const caseMonth = this.caseDate.slice(0, 7);
        const curEnd = this.dashboardService.getFilterEndMonth();
        if (caseMonth > curEnd) {
          this.dashboardService.setDateFilters(this.dashboardService.getFilterStartMonth(), caseMonth);
        }
        if (continueInput) {
          this.successToast = `Kasus No RM "${payload.emrNumber}" berhasil disimpan! Form siap untuk pasien berikutnya.`;
          this.resetPartialForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          this.router.navigate(['/ugd-cases', this.indicatorId]);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = true;
        this.submitErrorMessage = err.error?.message || (typeof err.error === 'string' ? err.error : 'Gagal menyimpan kasus ke server database. Silakan coba kembali.');
        console.error('Error submitting ED case', err);
      }
    });
  }

  resetPartialForm(): void {
    // Preserve hospitalSiteId and caseDate for rapid consecutive entry
    this.emrNumber = '';
    this.patientInitials = '';
    this.doorTimeOnly = '';
    this.eventTimeOnly = '';
    this.clinicalNotes = '';
    this.medicalDiagnosis = '';
    this.assessmentTimeOnly = '';
    this.requestTimeOnly = '';
    this.prescriptionTimeOnly = '';
    this.previewMinutes = null;
    this.previewCompliant = false;
  }

  autoResize(target: EventTarget | null): void {
    const el = target as HTMLTextAreaElement;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.max(38, el.scrollHeight) + 'px';
    }
  }

  goBack(): void {
    this.router.navigate(['/ugd-cases', this.indicatorId]);
  }
}
