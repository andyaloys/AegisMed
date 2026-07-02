using AegisMed.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System;

namespace AegisMed.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<HospitalSite> HospitalSites => Set<HospitalSite>();
    public DbSet<QualityAudit> QualityAudits => Set<QualityAudit>();
    public DbSet<CapaAction> CapaActions => Set<CapaAction>();
    public DbSet<QualityIndicator> QualityIndicators => Set<QualityIndicator>();
    public DbSet<EdIndicator> EdIndicators => Set<EdIndicator>();
    public DbSet<EdCaseSubmission> EdCaseSubmissions => Set<EdCaseSubmission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure relationships
        modelBuilder.Entity<QualityAudit>()
            .HasOne(a => a.HospitalSite)
            .WithMany(s => s.Audits)
            .HasForeignKey(a => a.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CapaAction>()
            .HasOne(c => c.HospitalSite)
            .WithMany(s => s.CapaActions)
            .HasForeignKey(c => c.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<QualityIndicator>()
            .HasOne(i => i.HospitalSite)
            .WithMany(s => s.QualityIndicators)
            .HasForeignKey(i => i.HospitalSiteId)
            .OnDelete(DeleteBehavior.Cascade);

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

        // Fixed Guids for Seeds
        var site1 = new Guid("11111111-1111-1111-1111-111111111111");
        var site2 = new Guid("22222222-2222-2222-2222-222222222222");
        var site3 = new Guid("33333333-3333-3333-3333-333333333333");
        var site4 = new Guid("44444444-4444-4444-4444-444444444444");

        var indCardiology = new Guid("a0000000-a000-a000-a000-a00000000000");
        var indOrthopaedics = new Guid("a1111111-a111-a111-a111-a11111111111");
        var indNeurology = new Guid("a2222222-a222-a222-a222-a22222222222");
        var indGastro = new Guid("a3333333-a333-a333-a333-a33333333333");
        var indOncology = new Guid("a4444444-a444-a444-a444-a44444444444");

        // Seed initial data
        modelBuilder.Entity<HospitalSite>().HasData(
            new HospitalSite { Id = site1, Name = "Mayapada Hospital Jakarta", Code = "MYP-JKT", Region = "Western" },
            new HospitalSite { Id = site2, Name = "Mayapada Hospital Tangerang", Code = "MYP-TNG", Region = "Western" },
            new HospitalSite { Id = site3, Name = "Mayapada Hospital Surabaya", Code = "MYP-SUB", Region = "Eastern" },
            new HospitalSite { Id = site4, Name = "Mayapada Hospital Bogor", Code = "MYP-BGR", Region = "Western" }
        );

        modelBuilder.Entity<EdIndicator>().HasData(
            new EdIndicator { Id = indCardiology, Name = "Door-to-ECG (Cardiology)", Category = "Emergency Department", TargetDescription = "Target: <= 10 mins", TargetMinutes = 10.0 },
            new EdIndicator { Id = indOrthopaedics, Name = "Time to Analgesia (Orthopaedics)", Category = "Emergency Department", TargetDescription = "Target: <= 30 mins", TargetMinutes = 30.0 },
            new EdIndicator { Id = indNeurology, Name = "Door-to-CT Scan (Neurology)", Category = "Emergency Department", TargetDescription = "Target: <= 25 mins", TargetMinutes = 25.0 },
            new EdIndicator { Id = indGastro, Name = "Time to Initial Diagnosis (Gastrohepatology)", Category = "Emergency Department", TargetDescription = "Target: <= 60 mins (1 hr)", TargetMinutes = 60.0 },
            new EdIndicator { Id = indOncology, Name = "Time to Antibiotics (Oncology)", Category = "Emergency Department", TargetDescription = "Target: <= 60 mins", TargetMinutes = 60.0 }
        );

        modelBuilder.Entity<QualityAudit>().HasData(
            new QualityAudit { Id = new Guid("b1111111-b111-b111-b111-b11111111111"), Title = "Clinical Quality Audit Q2", Category = "Clinical", AuditDate = new DateTime(2026, 6, 15), Auditor = "Dr. Sarah", Score = 92.5, Status = AuditStatus.Completed, HospitalSiteId = site1 },
            new QualityAudit { Id = new Guid("b2222222-b222-b222-b222-b22222222222"), Title = "Emergency Response Protocol Audit", Category = "Safety", AuditDate = new DateTime(2026, 6, 18), Auditor = "John Doe", Score = 88.0, Status = AuditStatus.Completed, HospitalSiteId = site2 },
            new QualityAudit { Id = new Guid("b3333333-b333-b333-b333-b33333333333"), Title = "Medication Safety & Prescription Audit", Category = "Clinical", AuditDate = new DateTime(2026, 6, 20), Auditor = "Jane Smith", Score = 74.2, Status = AuditStatus.Completed, HospitalSiteId = site3 },
            new QualityAudit { Id = new Guid("b4444444-b444-b444-b444-b44444444444"), Title = "OT Sterility & Infection Control", Category = "Safety", AuditDate = new DateTime(2026, 6, 22), Auditor = "Dr. Sarah", Score = 0, Status = AuditStatus.InProgress, HospitalSiteId = site4 },
            new QualityAudit { Id = new Guid("b5555555-b555-b555-b555-b55555555555"), Title = "Patient Safety Goals (IPSG) Audit", Category = "Clinical", AuditDate = new DateTime(2026, 6, 10), Auditor = "Alice Brown", Score = 95.0, Status = AuditStatus.Completed, HospitalSiteId = site1 }
        );

        modelBuilder.Entity<CapaAction>().HasData(
            new CapaAction { Id = new Guid("c1111111-c111-c111-c111-c11111111111"), Title = "Emergency Cart Expiry System", Description = "Implement daily digital checklists for emergency cart expiration audits.", Status = CapaStatus.InProgress, Severity = CapaSeverity.High, CreatedDate = new DateTime(2026, 6, 20), DueDate = new DateTime(2026, 7, 10), HospitalSiteId = site3 },
            new CapaAction { Id = new Guid("c2222222-c222-c222-c222-c22222222222"), Title = "Standardize Code Blue Protocol", Description = "Standardize clinical response times for Code Blue incidents across all units.", Status = CapaStatus.Open, Severity = CapaSeverity.Critical, CreatedDate = new DateTime(2026, 6, 18), DueDate = new DateTime(2026, 6, 28), HospitalSiteId = site2 },
            new CapaAction { Id = new Guid("c3333333-c333-c333-c333-c33333333333"), Title = "Sound-Alike Drugs (LASA) Labeling", Description = "Re-label sound-alike look-alike medications in the main pharmacy.", Status = CapaStatus.Resolved, Severity = CapaSeverity.Medium, CreatedDate = new DateTime(2026, 6, 10), DueDate = new DateTime(2026, 6, 20), ResolvedDate = new DateTime(2026, 6, 14), HospitalSiteId = site1 },
            new CapaAction { Id = new Guid("c4444444-c444-c444-c444-c44444444444"), Title = "Replace OT HEPA Filters", Description = "Failure to replace HEPA filters in Operating Theatre 3 as scheduled.", Status = CapaStatus.Overdue, Severity = CapaSeverity.Critical, CreatedDate = new DateTime(2026, 5, 5), DueDate = new DateTime(2026, 6, 10), HospitalSiteId = site3 },
            new CapaAction { Id = new Guid("c5555555-c555-c555-c555-c55555555555"), Title = "Update General Safety Training Logs", Description = "Add missing orientation logs for nursing staff in Wing A.", Status = CapaStatus.Open, Severity = CapaSeverity.Low, CreatedDate = new DateTime(2026, 6, 22), DueDate = new DateTime(2026, 7, 15), HospitalSiteId = site4 }
        );

        modelBuilder.Entity<QualityIndicator>().HasData(
            new QualityIndicator { Id = new Guid("d1111111-d111-d111-d111-d11111111111"), Name = "Hand Hygiene Compliance", Category = "Patient Safety", Month = "2026-06", Value = 94.0, Target = 95.0, Unit = "%", HospitalSiteId = site1 },
            new QualityIndicator { Id = new Guid("d2222222-d222-d222-d222-d22222222222"), Name = "ER Waiting Time (Triage to MD)", Category = "Service Quality", Month = "2026-06", Value = 24.5, Target = 30.0, Unit = "Min", HospitalSiteId = site1 },
            new QualityIndicator { Id = new Guid("d3333333-d333-d333-d333-d33333333333"), Name = "Surgical Site Infection Rate", Category = "Clinical Quality", Month = "2026-06", Value = 0.8, Target = 1.2, Unit = "%", HospitalSiteId = site2 },
            new QualityIndicator { Id = new Guid("d4444444-d444-d444-d444-d44444444444"), Name = "Patient Fall Incidents", Category = "Patient Safety", Month = "2026-06", Value = 1.0, Target = 0.5, Unit = "Cases", HospitalSiteId = site3 },
            new QualityIndicator { Id = new Guid("d5555555-d555-d555-d555-d55555555555"), Name = "Medication Errors (Near Miss)", Category = "Patient Safety", Month = "2026-06", Value = 0.15, Target = 0.20, Unit = "%", HospitalSiteId = site4 }
        );

        // Seed ED Case Submissions (Golden Hour Initiative)
        modelBuilder.Entity<EdCaseSubmission>().HasData(
            // Site 1 - Mayapada Jakarta (MYP-JKT)
            new EdCaseSubmission { Id = new Guid("e0000001-e000-e000-e000-e00000000001"), EmrNumber = "EMR-1001", PatientInitials = "AA", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 10, 0, 0), EventTime = new DateTime(2026, 6, 1, 10, 8, 0), MinutesElapsed = 8, IsCompliant = true, ClinicalNotes = "Chest pain, ECG done in 8 mins.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Adrian, Sp.JP\",\"IsStemi\":true}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000002-e000-e000-e000-e00000000002"), EmrNumber = "EMR-1002", PatientInitials = "BB", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 2, 11, 30, 0), EventTime = new DateTime(2026, 6, 2, 11, 42, 0), MinutesElapsed = 12, IsCompliant = false, ClinicalNotes = "ECG device delay.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Sarah, Sp.JP\",\"IsStemi\":false}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000003-e000-e000-e000-e00000000003"), EmrNumber = "EMR-1003", PatientInitials = "CC", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 3, 14, 0, 0), EventTime = new DateTime(2026, 6, 3, 14, 22, 0), MinutesElapsed = 22, IsCompliant = true, ClinicalNotes = "Femur fracture, Analgesia given.", CustomFieldsJson = "{\"PainScore\":8,\"AnalgesiaType\":\"Ketorolac IV\"}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000004-e000-e000-e000-e00000000004"), EmrNumber = "EMR-1004", PatientInitials = "DD", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 4, 9, 0, 0), EventTime = new DateTime(2026, 6, 4, 9, 18, 0), MinutesElapsed = 18, IsCompliant = true, ClinicalNotes = "Stroke symptoms, door-to-CT 18 mins.", CustomFieldsJson = "{\"CtOrderTime\":\"2026-06-04T09:05:00\",\"NihssScore\":14}", HospitalSiteId = site1 },
            new EdCaseSubmission { Id = new Guid("e0000005-e000-e000-e000-e00000000005"), EmrNumber = "EMR-1005", PatientInitials = "EE", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 5, 15, 0, 0), EventTime = new DateTime(2026, 6, 5, 15, 32, 0), MinutesElapsed = 32, IsCompliant = false, ClinicalNotes = "CT room occupied.", CustomFieldsJson = "{\"CtOrderTime\":\"2026-06-05T15:10:00\",\"NihssScore\":18}", HospitalSiteId = site1 },

            // Site 2 - Mayapada Tangerang (MYP-TNG)
            new EdCaseSubmission { Id = new Guid("e0000006-e000-e000-e000-e00000000006"), EmrNumber = "EMR-2001", PatientInitials = "FF", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 8, 15, 0), EventTime = new DateTime(2026, 6, 1, 8, 21, 0), MinutesElapsed = 6, IsCompliant = true, ClinicalNotes = "Acute myocardial infarction.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Adrian, Sp.JP\",\"IsStemi\":true}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000007-e000-e000-e000-e00000000007"), EmrNumber = "EMR-2002", PatientInitials = "GG", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 2, 13, 0, 0), EventTime = new DateTime(2026, 6, 2, 13, 45, 0), MinutesElapsed = 45, IsCompliant = false, ClinicalNotes = "Analgesia ordering delay.", CustomFieldsJson = "{\"PainScore\":9,\"AnalgesiaType\":\"Morphine IV\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000008-e000-e000-e000-e00000000008"), EmrNumber = "EMR-2003", PatientInitials = "HH", SubmissionMonth = "2026-06", EdIndicatorId = indGastro, DoorTime = new DateTime(2026, 6, 3, 10, 0, 0), EventTime = new DateTime(2026, 6, 3, 10, 50, 0), MinutesElapsed = 50, IsCompliant = true, ClinicalNotes = "Acute appendicitis.", CustomFieldsJson = "{\"ConsultTime\":\"2026-06-03T10:20:00\",\"PrimaryDiagnosis\":\"Acute Appendicitis\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000009-e000-e000-e000-e00000000009"), EmrNumber = "EMR-2004", PatientInitials = "II", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 4, 16, 30, 0), EventTime = new DateTime(2026, 6, 4, 17, 15, 0), MinutesElapsed = 45, IsCompliant = true, ClinicalNotes = "Febrile neutropenia, antibiotics in 45 mins.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-04T16:00:00\",\"AntibioticName\":\"Ceftazidime\"}", HospitalSiteId = site2 },
            new EdCaseSubmission { Id = new Guid("e0000010-e000-e000-e000-e00000000010"), EmrNumber = "EMR-2005", PatientInitials = "JJ", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 5, 20, 0, 0), EventTime = new DateTime(2026, 6, 5, 21, 10, 0), MinutesElapsed = 70, IsCompliant = false, ClinicalNotes = "Pharmacy delivery delay.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-05T19:30:00\",\"AntibioticName\":\"Meropenem\"}", HospitalSiteId = site2 },

            // Site 3 - Mayapada Surabaya (MYP-SUB)
            new EdCaseSubmission { Id = new Guid("e0000011-e000-e000-e000-e00000000011"), EmrNumber = "EMR-3001", PatientInitials = "KK", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 12, 0, 0), EventTime = new DateTime(2026, 6, 1, 12, 9, 0), MinutesElapsed = 9, IsCompliant = true, ClinicalNotes = "Fast response.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Tan, Sp.JP\",\"IsStemi\":false}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000012-e000-e000-e000-e00000000012"), EmrNumber = "EMR-3002", PatientInitials = "LL", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 2, 10, 0, 0), EventTime = new DateTime(2026, 6, 2, 10, 20, 0), MinutesElapsed = 20, IsCompliant = true, ClinicalNotes = "Stroke pathway.", CustomFieldsJson = "{\"CtOrderTime\":\"2026-06-02T10:05:00\",\"NihssScore\":8}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000013-e000-e000-e000-e00000000013"), EmrNumber = "EMR-3003", PatientInitials = "MM", SubmissionMonth = "2026-06", EdIndicatorId = indGastro, DoorTime = new DateTime(2026, 6, 3, 14, 0, 0), EventTime = new DateTime(2026, 6, 3, 15, 15, 0), MinutesElapsed = 75, IsCompliant = false, ClinicalNotes = "Diagnosis delay.", CustomFieldsJson = "{\"ConsultTime\":\"2026-06-03T14:40:00\",\"PrimaryDiagnosis\":\"Peritonitis secondary to Ruptured Appendix\"}", HospitalSiteId = site3 },
            new EdCaseSubmission { Id = new Guid("e0000014-e000-e000-e000-e00000000014"), EmrNumber = "EMR-3004", PatientInitials = "NN", SubmissionMonth = "2026-06", EdIndicatorId = indOrthopaedics, DoorTime = new DateTime(2026, 6, 4, 17, 0, 0), EventTime = new DateTime(2026, 6, 4, 17, 15, 0), MinutesElapsed = 15, IsCompliant = true, ClinicalNotes = "Quick pain relief.", CustomFieldsJson = "{\"PainScore\":7,\"AnalgesiaType\":\"Ibuprofen PO\"}", HospitalSiteId = site3 },

            // Site 4 - Mayapada Bogor (MYP-BGR)
            new EdCaseSubmission { Id = new Guid("e0000015-e000-e000-e000-e00000000015"), EmrNumber = "EMR-4001", PatientInitials = "OO", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 1, 7, 0, 0), EventTime = new DateTime(2026, 6, 1, 7, 7, 0), MinutesElapsed = 7, IsCompliant = true, ClinicalNotes = "Chest pain, rapid ECG.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Linda, Sp.JP\",\"IsStemi\":true}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000016-e000-e000-e000-e00000000016"), EmrNumber = "EMR-4002", PatientInitials = "PP", SubmissionMonth = "2026-06", EdIndicatorId = indCardiology, DoorTime = new DateTime(2026, 6, 2, 18, 0, 0), EventTime = new DateTime(2026, 6, 2, 18, 15, 0), MinutesElapsed = 15, IsCompliant = false, ClinicalNotes = "ECG printer paper issue.", CustomFieldsJson = "{\"EcgInterpreter\":\"Dr. Linda, Sp.JP\",\"IsStemi\":false}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000017-e000-e000-e000-e00000000017"), EmrNumber = "EMR-4003", PatientInitials = "QQ", SubmissionMonth = "2026-06", EdIndicatorId = indNeurology, DoorTime = new DateTime(2026, 6, 3, 11, 0, 0), EventTime = new DateTime(2026, 6, 3, 11, 22, 0), MinutesElapsed = 22, IsCompliant = true, ClinicalNotes = "Door-to-CT in 22 mins.", CustomFieldsJson = "{\"CtOrderTime\":\"2026-06-03T11:06:00\",\"NihssScore\":12}", HospitalSiteId = site4 },
            new EdCaseSubmission { Id = new Guid("e0000018-e000-e000-e000-e00000000018"), EmrNumber = "EMR-4004", PatientInitials = "RR", SubmissionMonth = "2026-06", EdIndicatorId = indOncology, DoorTime = new DateTime(2026, 6, 4, 15, 0, 0), EventTime = new DateTime(2026, 6, 4, 15, 40, 0), MinutesElapsed = 40, IsCompliant = true, ClinicalNotes = "Febrile neutropenia protocol followed.", CustomFieldsJson = "{\"FeverTime\":\"2026-06-04T14:30:00\",\"AntibioticName\":\"Cefepime\"}", HospitalSiteId = site4 }
        );
    }
}
