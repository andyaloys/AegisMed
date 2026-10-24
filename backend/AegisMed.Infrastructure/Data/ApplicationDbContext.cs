using AegisMed.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System;

namespace AegisMed.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    // Existing DbSets
    public DbSet<HospitalSite> HospitalSites => Set<HospitalSite>();
    public DbSet<CapaAction> CapaActions => Set<CapaAction>();
    public DbSet<EdIndicator> EdIndicators => Set<EdIndicator>();
    public DbSet<EdCaseSubmission> EdCaseSubmissions => Set<EdCaseSubmission>();
    public DbSet<ClosedPeriod> ClosedPeriods => Set<ClosedPeriod>();

    // New NursQI DbSets
    public DbSet<HospitalUnit> HospitalUnits => Set<HospitalUnit>();
    public DbSet<AppRole> AppRoles => Set<AppRole>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<NsiIndicatorCategory> NsiIndicatorCategories => Set<NsiIndicatorCategory>();
    public DbSet<NsiIndicator> NsiIndicators => Set<NsiIndicator>();
    public DbSet<NsiAuditSubmission> NsiAuditSubmissions => Set<NsiAuditSubmission>();
    public DbSet<NsiAuditItem> NsiAuditItems => Set<NsiAuditItem>();
    public DbSet<PdsaAction> PdsaActions => Set<PdsaAction>();
    public DbSet<ApprovalHistory> ApprovalHistories => Set<ApprovalHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ══════════════════════════════════════════════════════════════
        // RELATIONSHIPS — Existing
        // ══════════════════════════════════════════════════════════════
        
        modelBuilder.Entity<CapaAction>()
            .HasOne(c => c.HospitalSite)
            .WithMany(s => s.CapaActions)
            .HasForeignKey(c => c.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CapaAction>()
            .HasOne(c => c.EdIndicator)
            .WithMany()
            .HasForeignKey(c => c.EdIndicatorId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<EdCaseSubmission>()
            .HasOne(e => e.HospitalSite)
            .WithMany()
            .HasForeignKey(e => e.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EdCaseSubmission>()
            .HasOne(e => e.EdIndicator)
            .WithMany()
            .HasForeignKey(e => e.EdIndicatorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EdCaseSubmission>()
            .HasOne(e => e.SubmittedBy)
            .WithMany()
            .HasForeignKey(e => e.SubmittedById)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<EdCaseSubmission>()
            .HasOne(e => e.ApprovedBy)
            .WithMany()
            .HasForeignKey(e => e.ApprovedById)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ClosedPeriod>()
            .HasOne(e => e.HospitalSite)
            .WithMany()
            .HasForeignKey(e => e.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        // ══════════════════════════════════════════════════════════════
        // RELATIONSHIPS — New NursQI Entities
        // ══════════════════════════════════════════════════════════════

        // HospitalUnit → HospitalSite
        modelBuilder.Entity<HospitalUnit>()
            .HasOne(u => u.HospitalSite)
            .WithMany(s => s.Units)
            .HasForeignKey(u => u.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        // AppUser → AppRole
        modelBuilder.Entity<AppUser>()
            .HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        // AppUser → HospitalSite
        modelBuilder.Entity<AppUser>()
            .HasOne(u => u.HospitalSite)
            .WithMany(s => s.Users)
            .HasForeignKey(u => u.HospitalSiteId)
            .OnDelete(DeleteBehavior.Restrict);

        // AppUser → HospitalUnit (optional)
        modelBuilder.Entity<AppUser>()
            .HasOne(u => u.HospitalUnit)
            .WithMany()
            .HasForeignKey(u => u.HospitalUnitId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Unique constraint on username
        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // NsiIndicator → NsiIndicatorCategory
        modelBuilder.Entity<NsiIndicator>()
            .HasOne(i => i.Category)
            .WithMany(c => c.Indicators)
            .HasForeignKey(i => i.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // NsiAuditSubmission → HospitalUnit
        modelBuilder.Entity<NsiAuditSubmission>()
            .HasOne(a => a.HospitalUnit)
            .WithMany(u => u.AuditSubmissions)
            .HasForeignKey(a => a.HospitalUnitId)
            .OnDelete(DeleteBehavior.Restrict);

        // NsiAuditSubmission → NsiIndicator
        modelBuilder.Entity<NsiAuditSubmission>()
            .HasOne(a => a.NsiIndicator)
            .WithMany(i => i.AuditSubmissions)
            .HasForeignKey(a => a.NsiIndicatorId)
            .OnDelete(DeleteBehavior.Restrict);

        // NsiAuditSubmission → SubmittedBy (AppUser)
        modelBuilder.Entity<NsiAuditSubmission>()
            .HasOne(a => a.SubmittedBy)
            .WithMany()
            .HasForeignKey(a => a.SubmittedById)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // NsiAuditSubmission → ApprovedBy (AppUser)
        modelBuilder.Entity<NsiAuditSubmission>()
            .HasOne(a => a.ApprovedBy)
            .WithMany()
            .HasForeignKey(a => a.ApprovedById)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // NsiAuditItem → NsiAuditSubmission
        modelBuilder.Entity<NsiAuditItem>()
            .HasOne(i => i.Submission)
            .WithMany(s => s.Items)
            .HasForeignKey(i => i.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        // PdsaAction → HospitalUnit
        modelBuilder.Entity<PdsaAction>()
            .HasOne(p => p.HospitalUnit)
            .WithMany()
            .HasForeignKey(p => p.HospitalUnitId)
            .OnDelete(DeleteBehavior.Restrict);

        // PdsaAction → NsiIndicator
        modelBuilder.Entity<PdsaAction>()
            .HasOne(p => p.NsiIndicator)
            .WithMany()
            .HasForeignKey(p => p.NsiIndicatorId)
            .OnDelete(DeleteBehavior.Restrict);

        // PdsaAction → CreatedBy (AppUser)
        modelBuilder.Entity<PdsaAction>()
            .HasOne(p => p.CreatedBy)
            .WithMany()
            .HasForeignKey(p => p.CreatedById)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // PdsaAction → VerifiedBy (AppUser)
        modelBuilder.Entity<PdsaAction>()
            .HasOne(p => p.VerifiedBy)
            .WithMany()
            .HasForeignKey(p => p.VerifiedById)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // ApprovalHistory → ActionBy (AppUser)
        modelBuilder.Entity<ApprovalHistory>()
            .HasOne(h => h.ActionBy)
            .WithMany()
            .HasForeignKey(h => h.ActionById)
            .OnDelete(DeleteBehavior.Restrict);

        // ══════════════════════════════════════════════════════════════
        // SEED DATA
        // ══════════════════════════════════════════════════════════════

        // ── Hospital Sites (existing) ────────────────────────────────
        var site1 = new Guid("11111111-1111-1111-1111-111111111111");
        var site2 = new Guid("22222222-2222-2222-2222-222222222222");
        var site3 = new Guid("33333333-3333-3333-3333-333333333333");
        var site4 = new Guid("44444444-4444-4444-4444-444444444444");
        var site5 = new Guid("55555555-5555-5555-5555-555555555555");
        var site6 = new Guid("66666666-6666-6666-6666-666666666666");
        var site7 = new Guid("77777777-7777-7777-7777-777777777777");
        var site8 = new Guid("88888888-8888-8888-8888-888888888888");

        modelBuilder.Entity<HospitalSite>().HasData(
            new HospitalSite { Id = site1, Name = "Mayapada Hospital Jakarta Selatan", Code = "MHJS", Region = "Western" },
            new HospitalSite { Id = site2, Name = "Mayapada Hospital Tangerang", Code = "MHTG", Region = "Western" },
            new HospitalSite { Id = site3, Name = "Mayapada Hospital Surabaya", Code = "MHSB", Region = "Eastern" },
            new HospitalSite { Id = site4, Name = "Mayapada Hospital Bogor", Code = "MHBG", Region = "Western" },
            new HospitalSite { Id = site5, Name = "Mayapada Hospital Kuningan", Code = "MHKN", Region = "Western" },
            new HospitalSite { Id = site6, Name = "Mayapada Hospital Bandung", Code = "MHBD", Region = "Western" },
            new HospitalSite { Id = site7, Name = "Mayapada Hospital Jakarta Timur", Code = "MHJT", Region = "Western" },
            new HospitalSite { Id = site8, Name = "Mayapada Hospital Nusantara", Code = "MHNS", Region = "Eastern" }
        );

        // ── ED Indicators (existing) ─────────────────────────────────
        var indCardiology = new Guid("a0000000-a000-a000-a000-a00000000000");
        var indOrthopaedics = new Guid("a1111111-a111-a111-a111-a11111111111");
        var indNeurology = new Guid("a2222222-a222-a222-a222-a22222222222");
        var indGastro = new Guid("a3333333-a333-a333-a333-a33333333333");
        var indOncology = new Guid("a4444444-a444-a444-a444-a44444444444");
        var indMomChildren = new Guid("a5555555-a555-a555-a555-a55555555555");

        modelBuilder.Entity<EdIndicator>().HasData(
            new EdIndicator { Id = indCardiology, Name = "Door-to-ECG (Cardiology)", Category = "Emergency Department", TargetDescription = "Target: <= 10 mins", TargetMinutes = 10.0 },
            new EdIndicator { Id = indOrthopaedics, Name = "Time to Analgesia (Orthopaedics)", Category = "Emergency Department", TargetDescription = "Target: <= 30 mins", TargetMinutes = 30.0 },
            new EdIndicator { Id = indNeurology, Name = "Door-to-CT Scan (Neurology)", Category = "Emergency Department", TargetDescription = "Target: <= 25 mins", TargetMinutes = 25.0 },
            new EdIndicator { Id = indGastro, Name = "Time to Initial Diagnosis (Gastrohepatology)", Category = "Emergency Department", TargetDescription = "Target: <= 60 mins (1 hr)", TargetMinutes = 60.0 },
            new EdIndicator { Id = indOncology, Name = "Time to Antibiotics (Oncology)", Category = "Emergency Department", TargetDescription = "Target: <= 60 mins", TargetMinutes = 60.0 },
            new EdIndicator { Id = indMomChildren, Name = "Respon Time Bidan (Mom & Children)", Category = "Emergency Department", TargetDescription = "Target: <= 5 mins", TargetMinutes = 5.0 }
        );

        // ── CAPA Actions (existing) ──────────────────────────────────
        modelBuilder.Entity<CapaAction>().HasData(
            new CapaAction { Id = new Guid("c1111111-c111-c111-c111-c11111111111"), Title = "Emergency Cart Expiry System", Description = "Implement daily digital checklists for emergency cart expiration audits.", Status = CapaStatus.InProgress, Severity = CapaSeverity.High, CreatedDate = new DateTime(2026, 6, 20), DueDate = new DateTime(2026, 7, 10), HospitalSiteId = site3 },
            new CapaAction { Id = new Guid("c2222222-c222-c222-c222-c22222222222"), Title = "Standardize Code Blue Protocol", Description = "Standardize clinical response times for Code Blue incidents across all units.", Status = CapaStatus.Open, Severity = CapaSeverity.Critical, CreatedDate = new DateTime(2026, 6, 18), DueDate = new DateTime(2026, 6, 28), HospitalSiteId = site2 },
            new CapaAction { Id = new Guid("c3333333-c333-c333-c333-c33333333333"), Title = "Sound-Alike Drugs (LASA) Labeling", Description = "Re-label sound-alike look-alike medications in the main pharmacy.", Status = CapaStatus.Resolved, Severity = CapaSeverity.Medium, CreatedDate = new DateTime(2026, 6, 10), DueDate = new DateTime(2026, 6, 20), ResolvedDate = new DateTime(2026, 6, 14), HospitalSiteId = site1 },
            new CapaAction { Id = new Guid("c4444444-c444-c444-c444-c44444444444"), Title = "Replace OT HEPA Filters", Description = "Failure to replace HEPA filters in Operating Theatre 3 as scheduled.", Status = CapaStatus.Overdue, Severity = CapaSeverity.Critical, CreatedDate = new DateTime(2026, 5, 5), DueDate = new DateTime(2026, 6, 10), HospitalSiteId = site3 },
            new CapaAction { Id = new Guid("c5555555-c555-c555-c555-c55555555555"), Title = "Update General Safety Training Logs", Description = "Add missing orientation logs for nursing staff in Wing A.", Status = CapaStatus.Open, Severity = CapaSeverity.Low, CreatedDate = new DateTime(2026, 6, 22), DueDate = new DateTime(2026, 7, 15), HospitalSiteId = site4 }
        );

        // ── ED Case Submissions (existing) ───────────────────────────
        modelBuilder.Entity<EdCaseSubmission>().HasData(
            new EdCaseSubmission { Id = new Guid("e0000001-e000-e000-e000-e00000000001"), EmrNumber = "EMR-1001", PatientInitials = "AA", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 10, 0, 0), EventTime = new DateTime(2026, 6, 1, 10, 8, 0), MinutesElapsed = 8, IsCompliant = true, ClinicalNotes = "Chest pain, ECG done in 8 mins.", CustomFieldsJson = "{}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000002-e000-e000-e000-e00000000002"), EmrNumber = "EMR-1002", PatientInitials = "BB", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 2, 11, 30, 0), EventTime = new DateTime(2026, 6, 2, 11, 42, 0), MinutesElapsed = 12, IsCompliant = false, ClinicalNotes = "ECG device delay.", CustomFieldsJson = "{}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000003-e000-e000-e000-e00000000003"), EmrNumber = "EMR-1003", PatientInitials = "CC", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 3, 14, 0, 0), EventTime = new DateTime(2026, 6, 3, 14, 22, 0), MinutesElapsed = 22, IsCompliant = true, ClinicalNotes = "Femur fracture, Analgesia given.", CustomFieldsJson = "{\"PainScore\":8,\"MedicalDiagnosis\":\"Fraktur Femur Dekstra\",\"AssessmentTime\":\"2026-06-03T14:05:00\"}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000004-e000-e000-e000-e00000000004"), EmrNumber = "EMR-1004", PatientInitials = "DD", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 4, 9, 0, 0), EventTime = new DateTime(2026, 6, 4, 9, 18, 0), MinutesElapsed = 18, IsCompliant = true, ClinicalNotes = "Stroke symptoms, door-to-CT 18 mins.", CustomFieldsJson = "{\"MedicalDiagnosis\":\"Stroke Iskemik Akut\",\"RadiologyAction\":\"CT Scan Kepala Non-Kontras\"}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000005-e000-e000-e000-e00000000005"), EmrNumber = "EMR-1005", PatientInitials = "EE", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 5, 15, 0, 0), EventTime = new DateTime(2026, 6, 5, 15, 32, 0), MinutesElapsed = 32, IsCompliant = false, ClinicalNotes = "CT room occupied.", CustomFieldsJson = "{\"MedicalDiagnosis\":\"Stroke Hemoragik Akut\",\"RadiologyAction\":\"CT Scan Kepala Non-Kontras\"}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000006-e000-e000-e000-e00000000006"), EmrNumber = "EMR-2001", PatientInitials = "FF", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 8, 15, 0), EventTime = new DateTime(2026, 6, 1, 8, 21, 0), MinutesElapsed = 6, IsCompliant = true, ClinicalNotes = "Acute myocardial infarction.", CustomFieldsJson = "{}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000007-e000-e000-e000-e00000000007"), EmrNumber = "EMR-2002", PatientInitials = "GG", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 2, 13, 0, 0), EventTime = new DateTime(2026, 6, 2, 13, 45, 0), MinutesElapsed = 45, IsCompliant = false, ClinicalNotes = "Analgesia ordering delay.", CustomFieldsJson = "{\"PainScore\":9,\"MedicalDiagnosis\":\"Vulnus Laceratum Manus\",\"AssessmentTime\":\"2026-06-02T13:05:00\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000008-e000-e000-e000-e00000000008"), EmrNumber = "EMR-2003", PatientInitials = "HH", SubmissionMonth = "2026-06", EdIndicatorId = indGastro, DoorTime = new DateTime(2026, 6, 3, 10, 0, 0), EventTime = new DateTime(2026, 6, 3, 10, 50, 0), MinutesElapsed = 50, IsCompliant = true, ClinicalNotes = "Acute appendicitis.", CustomFieldsJson = "{\"ConsultTime\":\"2026-06-03T10:20:00\",\"PrimaryDiagnosis\":\"Acute Appendicitis\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000009-e000-e000-e000-e00000000009"), EmrNumber = "EMR-2004", PatientInitials = "II", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 4, 16, 30, 0), EventTime = new DateTime(2026, 6, 4, 17, 15, 0), MinutesElapsed = 45, IsCompliant = true, ClinicalNotes = "Febrile neutropenia, antibiotics in 45 mins.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-04T16:00:00\",\"AntibioticName\":\"Ceftazidime\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000010-e000-e000-e000-e00000000010"), EmrNumber = "EMR-2005", PatientInitials = "JJ", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 5, 20, 0, 0), EventTime = new DateTime(2026, 6, 5, 21, 10, 0), MinutesElapsed = 70, IsCompliant = false, ClinicalNotes = "Pharmacy delivery delay.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-05T19:30:00\",\"AntibioticName\":\"Meropenem\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000011-e000-e000-e000-e00000000011"), EmrNumber = "EMR-3001", PatientInitials = "KK", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 12, 0, 0), EventTime = new DateTime(2026, 6, 1, 12, 9, 0), MinutesElapsed = 9, IsCompliant = true, ClinicalNotes = "Fast response.", CustomFieldsJson = "{}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000012-e000-e000-e000-e00000000012"), EmrNumber = "EMR-3002", PatientInitials = "LL", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 2, 10, 0, 0), EventTime = new DateTime(2026, 6, 2, 10, 20, 0), MinutesElapsed = 20, IsCompliant = true, ClinicalNotes = "Stroke pathway.", CustomFieldsJson = "{\"MedicalDiagnosis\":\"Stroke Iskemik Akut\",\"RadiologyAction\":\"MRI Kepala\"}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000013-e000-e000-e000-e00000000013"), EmrNumber = "EMR-3003", PatientInitials = "MM", SubmissionMonth = "2026-06", EdIndicatorId = indGastro, DoorTime = new DateTime(2026, 6, 3, 14, 0, 0), EventTime = new DateTime(2026, 6, 3, 15, 15, 0), MinutesElapsed = 75, IsCompliant = false, ClinicalNotes = "Diagnosis delay.", CustomFieldsJson = "{\"MedicalDiagnosis\":\"Apendisitis Akut Pecah (Peritonitis)\",\"DiagnosticExam\":\"CT Scan Abdomen\",\"AssessmentTime\":\"2026-06-03T14:05:00\",\"RequestTime\":\"2026-06-03T14:20:00\"}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000014-e000-e000-e000-e00000000014"), EmrNumber = "EMR-3004", PatientInitials = "NN", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 4, 17, 0, 0), EventTime = new DateTime(2026, 6, 4, 17, 15, 0), MinutesElapsed = 15, IsCompliant = true, ClinicalNotes = "Quick pain relief.", CustomFieldsJson = "{\"PainScore\":7,\"MedicalDiagnosis\":\"Dislokasi Sendi Bahu Sinistra\",\"AssessmentTime\":\"2026-06-04T17:02:00\"}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000015-e000-e000-e000-e00000000015"), EmrNumber = "EMR-4001", PatientInitials = "OO", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 7, 0, 0), EventTime = new DateTime(2026, 6, 1, 7, 7, 0), MinutesElapsed = 7, IsCompliant = true, ClinicalNotes = "Chest pain, rapid ECG.", CustomFieldsJson = "{}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000016-e000-e000-e000-e00000000016"), EmrNumber = "EMR-4002", PatientInitials = "PP", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 2, 18, 0, 0), EventTime = new DateTime(2026, 6, 2, 18, 15, 0), MinutesElapsed = 15, IsCompliant = false, ClinicalNotes = "ECG printer paper issue.", CustomFieldsJson = "{}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000017-e000-e000-e000-e00000000017"), EmrNumber = "EMR-4003", PatientInitials = "QQ", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 3, 11, 0, 0), EventTime = new DateTime(2026, 6, 3, 11, 22, 0), MinutesElapsed = 22, IsCompliant = true, ClinicalNotes = "Door-to-CT in 22 mins.", CustomFieldsJson = "{\"MedicalDiagnosis\":\"Stroke Iskemik Akut\",\"RadiologyAction\":\"CT Scan Kepala Non-Kontras\"}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000018-e000-e000-e000-e00000000018"), EmrNumber = "EMR-4004", PatientInitials = "RR", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 4, 15, 0, 0), EventTime = new DateTime(2026, 6, 4, 15, 40, 0), MinutesElapsed = 40, IsCompliant = true, ClinicalNotes = "Febrile neutropenia protocol followed.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-04T14:30:00\",\"AntibioticName\":\"Cefepime\"}", HospitalSiteId = site4 }
        );

        // ══════════════════════════════════════════════════════════════
        // NEW SEED DATA — NursQI System
        // ══════════════════════════════════════════════════════════════

        // ── App Roles ────────────────────────────────────────────────
        var rolePSQO     = new Guid("a0000001-0000-0000-0000-000000000001");
        var roleKanit    = new Guid("a0000002-0000-0000-0000-000000000002");
        var roleKadeptNQ = new Guid("a0000003-0000-0000-0000-000000000003");
        var roleNQCorp   = new Guid("a0000004-0000-0000-0000-000000000004");
        var roleQRUnit   = new Guid("a0000005-0000-0000-0000-000000000005");
        var roleQRCorp   = new Guid("a0000006-0000-0000-0000-000000000006");
        var roleAdmin    = new Guid("a0000007-0000-0000-0000-000000000007");

        modelBuilder.Entity<AppRole>().HasData(
            new AppRole { Id = rolePSQO, Name = "PSQO", DisplayName = "PSQO / PJ Shift", Scope = "Unit", Level = 1,
                PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":false,\"canExport\":true,\"canManageUsers\":false}" },
            new AppRole { Id = roleKanit, Name = "Kanit", DisplayName = "Kepala Unit", Scope = "Unit", Level = 2,
                PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":true,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":false,\"canViewDashboardCorp\":false,\"canExport\":false,\"canManageUsers\":false}" },
            new AppRole { Id = roleKadeptNQ, Name = "KadeptNQ", DisplayName = "Kadept Nursing Quality", Scope = "Hospital", Level = 3,
                PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":false,\"canVerifyPdsa\":true,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":false,\"canExport\":true,\"canManageUsers\":false}" },
            new AppRole { Id = roleNQCorp, Name = "NQCorp", DisplayName = "Nursing Quality Corporate", Scope = "Corporate", Level = 4,
                PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":true,\"canManageUsers\":false}" },
            new AppRole { Id = roleQRUnit, Name = "QRUnit", DisplayName = "Quality Representative Unit", Scope = "Unit", Level = 0,
                PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":false,\"canViewDashboardCorp\":false,\"canExport\":false,\"canManageUsers\":false}" },
            new AppRole { Id = roleQRCorp, Name = "QRCorp", DisplayName = "Quality Representative Corporate", Scope = "Corporate", Level = 0,
                PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":false,\"canManageUsers\":false}" },
            new AppRole { Id = roleAdmin, Name = "Admin", DisplayName = "System Administrator", Scope = "Corporate", Level = 99,
                PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":true,\"canVerifyPdsa\":true,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":true,\"canManageUsers\":true}" }
        );

        // ── Standard Hospital Units (same for all 8 MH sites) ────────
        // 10 standard units × 8 sites = 80 unit records
        var unitNames = new[] {
            ("IGD",                "IGD"),
            ("ICU",                "ICU"),
            ("Rawat Inap",         "RI"),
            ("Rawat Jalan",        "RJ"),
            ("Kamar Operasi",      "OK"),
            ("Perinatologi/NICU",  "NICU"),
            ("Hemodialisa",        "HD"),
            ("Endoskopi",          "ENDO"),
            ("Medical Check Up",   "MCU"),
            ("VK / Kebidanan",     "VK")
        };

        var siteIds = new[] { site1, site2, site3, site4, site5, site6, site7, site8 };
        var allUnits = new List<HospitalUnit>();
        int unitCounter = 1;
        
        foreach (var siteId in siteIds)
        {
            foreach (var (name, code) in unitNames)
            {
                allUnits.Add(new HospitalUnit
                {
                    Id = new Guid($"b{unitCounter:D7}-0000-0000-0000-000000000000"),
                    Name = name,
                    Code = code,
                    HospitalSiteId = siteId,
                    IsActive = true
                });
                unitCounter++;
            }
        }
        modelBuilder.Entity<HospitalUnit>().HasData(allUnits.ToArray());

        // ── Default Admin User ───────────────────────────────────────
        // Password: Admin@123 → BCrypt hash
        var adminUserId = new Guid("ad000001-0000-0000-0000-000000000001");
        modelBuilder.Entity<AppUser>().HasData(
            new AppUser
            {
                Id = adminUserId,
                FullName = "System Administrator",
                Email = "admin@aegismed.id",
                Username = "admin",
                // BCrypt hash of "Admin@123"
                PasswordHash = "$2a$11$K2x0hR6LZMFOD4VQ3gNZkeNElPGrJCnVq1VZ3c1SyBZz0q.2Z3Ydy",
                RoleId = roleAdmin,
                HospitalSiteId = site1,
                HospitalUnitId = null,
                IsActive = true,
                CreatedDate = DateTime.SpecifyKind(new DateTime(2026, 1, 1), DateTimeKind.Utc)
            }
        );

        // ── NSI Indicator Categories ─────────────────────────────────
        var catNursDoc  = new Guid("ca000001-0000-0000-0000-000000000001");
        var catRekMed   = new Guid("ca000002-0000-0000-0000-000000000002");
        var catEdukasi  = new Guid("ca000003-0000-0000-0000-000000000003");
        var catMonitor  = new Guid("ca000004-0000-0000-0000-000000000004");
        var catProjIGD  = new Guid("ca000005-0000-0000-0000-000000000005");

        modelBuilder.Entity<NsiIndicatorCategory>().HasData(
            new NsiIndicatorCategory { Id = catNursDoc, Name = "Kepatuhan Dokumentasi Keperawatan", Code = "DOK-KEP", SortOrder = 1 },
            new NsiIndicatorCategory { Id = catRekMed, Name = "Kelengkapan Pendokumentasian Berkas Rekam Medis", Code = "REK-MED", SortOrder = 2 },
            new NsiIndicatorCategory { Id = catEdukasi, Name = "Kepatuhan Edukasi & Tata Laksana", Code = "EDUKASI", SortOrder = 3 },
            new NsiIndicatorCategory { Id = catMonitor, Name = "Ketepatan Monitoring & Tata Laksana", Code = "MONITOR", SortOrder = 4 },
            new NsiIndicatorCategory { Id = catProjIGD, Name = "Project Improvement IGD", Code = "PROJ-IGD", SortOrder = 5 }
        );

        // ── NSI Indicators (14 checklist + 6 time-based) ─────────────
        modelBuilder.Entity<NsiIndicator>().HasData(
            // Category 1: Kepatuhan Dokumentasi Keperawatan
            new NsiIndicator { Id = new Guid("da000001-0000-0000-0000-000000000001"), Name = "Kepatuhan Pendokumentasian Nursing Care Plan (NCP)", Code = "NSI-NCP", CategoryId = catNursDoc, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 1, IsActive = true },
            new NsiIndicator { Id = new Guid("da000002-0000-0000-0000-000000000002"), Name = "Responsiveness Nursing of Call", Code = "NSI-RNC", CategoryId = catNursDoc, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 2, IsActive = true },

            // Category 2: Kelengkapan Rekam Medis
            new NsiIndicator { Id = new Guid("da000003-0000-0000-0000-000000000003"), Name = "Pengkajian Awal Pasien IGD", Code = "NSI-IGD-ASSESS", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 3, IsActive = true },
            new NsiIndicator { Id = new Guid("da000004-0000-0000-0000-000000000004"), Name = "Pengkajian Awal Pasien Rawat Inap", Code = "NSI-RI-ASSESS", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 4, IsActive = true },
            new NsiIndicator { Id = new Guid("da000005-0000-0000-0000-000000000005"), Name = "Catatan Perkembangan Pasien Terintegrasi (CPPT)", Code = "NSI-CPPT", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 5, IsActive = true },
            new NsiIndicator { Id = new Guid("da000006-0000-0000-0000-000000000006"), Name = "Catatan Pengobatan (paraf & tanggal perawat)", Code = "NSI-MED-REC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 6, IsActive = true },
            new NsiIndicator { Id = new Guid("da000007-0000-0000-0000-000000000007"), Name = "Informed Consent", Code = "NSI-IC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 7, IsActive = true },
            new NsiIndicator { Id = new Guid("da000008-0000-0000-0000-000000000008"), Name = "Surgical Safety Checklist", Code = "NSI-SSC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 8, IsActive = true },
            new NsiIndicator { Id = new Guid("da000009-0000-0000-0000-000000000009"), Name = "Asuhan Keperawatan Perioperatif", Code = "NSI-PERIOP", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 9, IsActive = true },
            new NsiIndicator { Id = new Guid("da00000a-0000-0000-0000-000000000010"), Name = "Form Transfer Internal (bagian nursing)", Code = "NSI-TRANSFER", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 10, IsActive = true },

            // Category 3: Kepatuhan Edukasi
            new NsiIndicator { Id = new Guid("da00000b-0000-0000-0000-000000000011"), Name = "Kepatuhan Pemberian Edukasi Pasien dan Keluarga", Code = "NSI-EDUKASI", CategoryId = catEdukasi, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 11, IsActive = true },

            // Category 4: Ketepatan Monitoring
            new NsiIndicator { Id = new Guid("da00000c-0000-0000-0000-000000000012"), Name = "Ketepatan Monitoring Tanda-Tanda Vital", Code = "NSI-VITAL", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 12, IsActive = true },
            new NsiIndicator { Id = new Guid("da00000d-0000-0000-0000-000000000013"), Name = "Ketepatan Tata Laksana Nyeri Pasien", Code = "NSI-PAIN", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 13, IsActive = true },
            new NsiIndicator { Id = new Guid("da00000e-0000-0000-0000-000000000014"), Name = "Ketepatan Tata Laksana EWS", Code = "NSI-EWS", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 14, IsActive = true },

            // Category 5: Project Improvement IGD (Time-Based — mirrors existing EdIndicators)
            new NsiIndicator { Id = new Guid("da00000f-0000-0000-0000-000000000015"), Name = "Door to ECG ≤ 10 menit", Code = "PI-ECG", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 10, TargetPercentage = 100, SortOrder = 15, IsActive = true },
            new NsiIndicator { Id = new Guid("da000010-0000-0000-0000-000000000016"), Name = "Door to CT Scan ≤ 25 menit", Code = "PI-CT", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 25, TargetPercentage = 100, SortOrder = 16, IsActive = true },
            new NsiIndicator { Id = new Guid("da000011-0000-0000-0000-000000000017"), Name = "Door to Analgetic ≤ 60 menit", Code = "PI-ANALGESIC", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 17, IsActive = true },
            new NsiIndicator { Id = new Guid("da000012-0000-0000-0000-000000000018"), Name = "Door to Initial Diagnosis ≤ 60 menit", Code = "PI-DIAGNOSIS", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 18, IsActive = true },
            new NsiIndicator { Id = new Guid("da000013-0000-0000-0000-000000000019"), Name = "Door to Antibiotics ≤ 60 menit", Code = "PI-ANTIBIOTICS", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 19, IsActive = true },
            new NsiIndicator { Id = new Guid("da000014-0000-0000-0000-000000000020"), Name = "Responsiveness Maternal Emergency ≤ 5 menit", Code = "PI-MATERNAL", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 5, TargetPercentage = 100, SortOrder = 20, IsActive = true }
        );
    }
}
