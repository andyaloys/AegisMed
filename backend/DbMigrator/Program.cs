using AegisMed.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;

AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

Console.WriteLine("Connecting to database aegismed_qms_pg...");
var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
optionsBuilder.UseNpgsql("Host=localhost;Database=aegismed_qms_pg;Username=postgres;Password=postgres;");

using var context = new ApplicationDbContext(optionsBuilder.Options);

try
{
    var script = context.Database.GenerateCreateScript();
    Console.WriteLine("Generated create script length: " + script.Length);
    
    // Execute DDL safely
    // Since some tables like HospitalSites, EdIndicators, EdCaseSubmissions, CapaActions may already exist,
    // let's create the new tables if they don't exist:
    // "AppRoles", "HospitalUnits", "AppUsers", "NsiIndicatorCategories", "NsiIndicators", "NsiAuditSubmissions", "NsiAuditItems", "PdsaActions", "ApprovalHistories"
    
    var conn = context.Database.GetDbConnection();
    conn.Open();
    using var cmd = conn.CreateCommand();
    
    // Drop new tables if existed with incorrect schemas
    cmd.CommandText = @"
    DROP TABLE IF EXISTS ""ApprovalHistories"" CASCADE;
    DROP TABLE IF EXISTS ""PdsaActions"" CASCADE;
    DROP TABLE IF EXISTS ""NsiAuditItems"" CASCADE;
    DROP TABLE IF EXISTS ""NsiAuditSubmissions"" CASCADE;
    DROP TABLE IF EXISTS ""NsiIndicators"" CASCADE;
    DROP TABLE IF EXISTS ""NsiIndicatorCategories"" CASCADE;
    DROP TABLE IF EXISTS ""AppUsers"" CASCADE;
    DROP TABLE IF EXISTS ""HospitalUnits"" CASCADE;
    DROP TABLE IF EXISTS ""AppRoles"" CASCADE;

    CREATE TABLE ""AppRoles"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""Name"" text NOT NULL,
        ""DisplayName"" text NOT NULL,
        ""Scope"" text NOT NULL,
        ""Level"" integer NOT NULL,
        ""PermissionsJson"" text NOT NULL
    );

    CREATE TABLE ""HospitalUnits"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""Name"" text NOT NULL,
        ""Code"" text NOT NULL,
        ""HospitalSiteId"" uuid NOT NULL REFERENCES ""HospitalSites""(""Id"") ON DELETE CASCADE,
        ""IsActive"" boolean NOT NULL DEFAULT true
    );

    CREATE TABLE ""AppUsers"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""FullName"" text NOT NULL,
        ""Email"" text NOT NULL,
        ""Username"" text NOT NULL,
        ""PasswordHash"" text NOT NULL,
        ""RoleId"" uuid NOT NULL REFERENCES ""AppRoles""(""Id"") ON DELETE RESTRICT,
        ""HospitalSiteId"" uuid NOT NULL REFERENCES ""HospitalSites""(""Id"") ON DELETE RESTRICT,
        ""HospitalUnitId"" uuid NULL REFERENCES ""HospitalUnits""(""Id"") ON DELETE SET NULL,
        ""IsActive"" boolean NOT NULL DEFAULT true,
        ""CreatedDate"" timestamp with time zone NOT NULL,
        ""LastLoginDate"" timestamp with time zone NULL
    );

    CREATE TABLE ""NsiIndicatorCategories"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""Name"" text NOT NULL,
        ""Code"" text NOT NULL,
        ""SortOrder"" integer NOT NULL
    );

    CREATE TABLE ""NsiIndicators"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""Name"" text NOT NULL,
        ""Code"" text NOT NULL,
        ""CategoryId"" uuid NOT NULL REFERENCES ""NsiIndicatorCategories""(""Id"") ON DELETE CASCADE,
        ""AuditType"" text NOT NULL,
        ""MeasurementType"" text NOT NULL,
        ""TargetMinutes"" double precision NULL,
        ""TargetPercentage"" double precision NOT NULL,
        ""SortOrder"" integer NOT NULL,
        ""IsActive"" boolean NOT NULL DEFAULT true
    );

    CREATE TABLE ""NsiAuditSubmissions"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""HospitalUnitId"" uuid NOT NULL REFERENCES ""HospitalUnits""(""Id"") ON DELETE RESTRICT,
        ""NsiIndicatorId"" uuid NOT NULL REFERENCES ""NsiIndicators""(""Id"") ON DELETE RESTRICT,
        ""SubmissionMonth"" text NOT NULL,
        ""AuditDate"" timestamp with time zone NOT NULL,
        ""Denominator"" integer NOT NULL,
        ""Numerator"" integer NOT NULL,
        ""AchievementRate"" double precision NOT NULL,
        ""Status"" integer NOT NULL,
        ""SubmittedById"" uuid NULL REFERENCES ""AppUsers""(""Id"") ON DELETE SET NULL,
        ""SubmittedDate"" timestamp with time zone NULL,
        ""ApprovedById"" uuid NULL REFERENCES ""AppUsers""(""Id"") ON DELETE SET NULL,
        ""ApprovedDate"" timestamp with time zone NULL,
        ""RejectionNotes"" text NULL,
        ""CreatedDate"" timestamp with time zone NOT NULL
    );

    CREATE TABLE ""NsiAuditItems"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""SubmissionId"" uuid NOT NULL REFERENCES ""NsiAuditSubmissions""(""Id"") ON DELETE CASCADE,
        ""ItemNumber"" integer NOT NULL,
        ""PatientIdentifier"" text NOT NULL,
        ""IsCompliant"" boolean NOT NULL,
        ""Notes"" text NOT NULL DEFAULT '',
        ""DoorTime"" timestamp with time zone NULL,
        ""EventTime"" timestamp with time zone NULL,
        ""MinutesElapsed"" double precision NULL,
        ""CustomFieldsJson"" text NOT NULL DEFAULT '{}'
    );

    CREATE TABLE ""PdsaActions"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""HospitalUnitId"" uuid NOT NULL REFERENCES ""HospitalUnits""(""Id"") ON DELETE RESTRICT,
        ""NsiIndicatorId"" uuid NOT NULL REFERENCES ""NsiIndicators""(""Id"") ON DELETE RESTRICT,
        ""Month"" text NOT NULL,
        ""AchievementRate"" double precision NOT NULL,
        ""Numerator"" integer NOT NULL,
        ""Denominator"" integer NOT NULL,
        ""RootCauseAnalysis"" text NOT NULL,
        ""ImprovementPlan"" text NOT NULL,
        ""PIC"" text NOT NULL,
        ""TargetDate"" timestamp with time zone NULL,
        ""Status"" integer NOT NULL,
        ""CreatedById"" uuid NULL REFERENCES ""AppUsers""(""Id"") ON DELETE SET NULL,
        ""CreatedDate"" timestamp with time zone NOT NULL,
        ""VerifiedById"" uuid NULL REFERENCES ""AppUsers""(""Id"") ON DELETE SET NULL,
        ""VerifiedDate"" timestamp with time zone NULL,
        ""RevisionNotes"" text NULL
    );

    CREATE TABLE ""ApprovalHistories"" (
        ""Id"" uuid NOT NULL PRIMARY KEY,
        ""EntityType"" text NOT NULL,
        ""EntityId"" uuid NOT NULL,
        ""FromStatus"" text NOT NULL,
        ""ToStatus"" text NOT NULL,
        ""ActionById"" uuid NOT NULL REFERENCES ""AppUsers""(""Id"") ON DELETE RESTRICT,
        ""ActionDate"" timestamp with time zone NOT NULL,
        ""Notes"" text NULL
    );
    ";
    cmd.ExecuteNonQuery();
    Console.WriteLine("All tables created successfully with accurate schemas!");

    // Seed AppRoles if empty
    if (!context.AppRoles.Any())
    {
        Console.WriteLine("Seeding AppRoles...");
        var roles = new[]
        {
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000001-0000-0000-0000-000000000001"), Name = "PSQO", DisplayName = "PSQO / PJ Shift", Scope = "Unit", Level = 1, PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":false,\"canExport\":true,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000002-0000-0000-0000-000000000002"), Name = "Kanit", DisplayName = "Kepala Unit", Scope = "Unit", Level = 2, PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":true,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":false,\"canViewDashboardCorp\":false,\"canExport\":false,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000003-0000-0000-0000-000000000003"), Name = "KadeptNQ", DisplayName = "Kadept Nursing Quality", Scope = "Hospital", Level = 3, PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":false,\"canVerifyPdsa\":true,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":false,\"canExport\":true,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000004-0000-0000-0000-000000000004"), Name = "NQCorp", DisplayName = "Nursing Quality Corporate", Scope = "Corporate", Level = 4, PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":true,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000005-0000-0000-0000-000000000005"), Name = "QRUnit", DisplayName = "Quality Representative Unit", Scope = "Unit", Level = 0, PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":false,\"canViewDashboardCorp\":false,\"canExport\":false,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000006-0000-0000-0000-000000000006"), Name = "QRCorp", DisplayName = "Quality Representative Corporate", Scope = "Corporate", Level = 0, PermissionsJson = "{\"canInputAudit\":false,\"canApprove\":false,\"canCreatePdsa\":false,\"canVerifyPdsa\":false,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":false,\"canManageUsers\":false}" },
            new AegisMed.Core.Entities.AppRole { Id = new Guid("a0000007-0000-0000-0000-000000000007"), Name = "Admin", DisplayName = "System Administrator", Scope = "Corporate", Level = 99, PermissionsJson = "{\"canInputAudit\":true,\"canApprove\":true,\"canCreatePdsa\":true,\"canVerifyPdsa\":true,\"canViewDashboardUnit\":true,\"canViewDashboardMH\":true,\"canViewDashboardCorp\":true,\"canExport\":true,\"canManageUsers\":true}" }
        };
        context.AppRoles.AddRange(roles);
        context.SaveChanges();
        Console.WriteLine($"Seeded {roles.Length} AppRoles.");
    }

    // Seed HospitalUnits if empty
    if (!context.HospitalUnits.Any())
    {
        Console.WriteLine("Seeding HospitalUnits...");
        var siteIds = context.HospitalSites.Select(s => s.Id).ToList();
        var unitNames = new[] {
            ("IGD", "IGD"), ("ICU", "ICU"), ("Rawat Inap", "RI"), ("Rawat Jalan", "RJ"),
            ("Kamar Operasi", "OK"), ("Perinatologi/NICU", "NICU"), ("Hemodialisa", "HD"),
            ("Endoskopi", "ENDO"), ("Medical Check Up", "MCU"), ("VK / Kebidanan", "VK")
        };

        var allUnits = new List<AegisMed.Core.Entities.HospitalUnit>();
        int unitCounter = 1;
        foreach (var siteId in siteIds)
        {
            foreach (var (name, code) in unitNames)
            {
                allUnits.Add(new AegisMed.Core.Entities.HospitalUnit
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
        context.HospitalUnits.AddRange(allUnits);
        context.SaveChanges();
        Console.WriteLine($"Seeded {allUnits.Count} HospitalUnits across {siteIds.Count} sites.");
    }

    // Seed NSI Indicator Categories if empty
    if (!context.NsiIndicatorCategories.Any())
    {
        Console.WriteLine("Seeding NsiIndicatorCategories...");
        var categories = new[]
        {
            new AegisMed.Core.Entities.NsiIndicatorCategory { Id = new Guid("ca000001-0000-0000-0000-000000000001"), Name = "Kepatuhan Dokumentasi Keperawatan", Code = "DOK-KEP", SortOrder = 1 },
            new AegisMed.Core.Entities.NsiIndicatorCategory { Id = new Guid("ca000002-0000-0000-0000-000000000002"), Name = "Kelengkapan Pendokumentasian Berkas Rekam Medis", Code = "REK-MED", SortOrder = 2 },
            new AegisMed.Core.Entities.NsiIndicatorCategory { Id = new Guid("ca000003-0000-0000-0000-000000000003"), Name = "Kepatuhan Edukasi & Tata Laksana", Code = "EDUKASI", SortOrder = 3 },
            new AegisMed.Core.Entities.NsiIndicatorCategory { Id = new Guid("ca000004-0000-0000-0000-000000000004"), Name = "Ketepatan Monitoring & Tata Laksana", Code = "MONITOR", SortOrder = 4 },
            new AegisMed.Core.Entities.NsiIndicatorCategory { Id = new Guid("ca000005-0000-0000-0000-000000000005"), Name = "Project Improvement IGD", Code = "PROJ-IGD", SortOrder = 5 }
        };
        context.NsiIndicatorCategories.AddRange(categories);
        context.SaveChanges();
        Console.WriteLine($"Seeded {categories.Length} NsiIndicatorCategories.");
    }

    // Seed NSI Indicators if empty
    if (!context.NsiIndicators.Any())
    {
        Console.WriteLine("Seeding NsiIndicators...");
        var catNursDoc = new Guid("ca000001-0000-0000-0000-000000000001");
        var catRekMed  = new Guid("ca000002-0000-0000-0000-000000000002");
        var catEdukasi = new Guid("ca000003-0000-0000-0000-000000000003");
        var catMonitor = new Guid("ca000004-0000-0000-0000-000000000004");
        var catProjIGD = new Guid("ca000005-0000-0000-0000-000000000005");

        var indicators = new[]
        {
            // Category 1: Kepatuhan Dokumentasi Keperawatan
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000001-0000-0000-0000-000000000001"), Name = "Kepatuhan Pendokumentasian Nursing Care Plan (NCP)", Code = "NSI-NCP", CategoryId = catNursDoc, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 1, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000002-0000-0000-0000-000000000002"), Name = "Responsiveness Nursing of Call", Code = "NSI-RNC", CategoryId = catNursDoc, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 2, IsActive = true },

            // Category 2: Kelengkapan Rekam Medis
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000003-0000-0000-0000-000000000003"), Name = "Pengkajian Awal Pasien IGD", Code = "NSI-IGD-ASSESS", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 3, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000004-0000-0000-0000-000000000004"), Name = "Pengkajian Awal Pasien Rawat Inap", Code = "NSI-RI-ASSESS", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 4, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000005-0000-0000-0000-000000000005"), Name = "Catatan Perkembangan Pasien Terintegrasi (CPPT)", Code = "NSI-CPPT", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 5, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000006-0000-0000-0000-000000000006"), Name = "Catatan Pengobatan (paraf & tanggal perawat)", Code = "NSI-MED-REC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 6, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000007-0000-0000-0000-000000000007"), Name = "Informed Consent", Code = "NSI-IC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 7, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000008-0000-0000-0000-000000000008"), Name = "Surgical Safety Checklist", Code = "NSI-SSC", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 8, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000009-0000-0000-0000-000000000009"), Name = "Asuhan Keperawatan Perioperatif", Code = "NSI-PERIOP", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 9, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000a-0000-0000-0000-000000000010"), Name = "Form Transfer Internal (bagian nursing)", Code = "NSI-TRANSFER", CategoryId = catRekMed, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 10, IsActive = true },

            // Category 3: Kepatuhan Edukasi
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000b-0000-0000-0000-000000000011"), Name = "Kepatuhan Pemberian Edukasi Pasien dan Keluarga", Code = "NSI-EDUKASI", CategoryId = catEdukasi, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 11, IsActive = true },

            // Category 4: Ketepatan Monitoring
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000c-0000-0000-0000-000000000012"), Name = "Ketepatan Monitoring Tanda-Tanda Vital", Code = "NSI-VITAL", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 12, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000d-0000-0000-0000-000000000013"), Name = "Ketepatan Tata Laksana Nyeri Pasien", Code = "NSI-PAIN", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 13, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000e-0000-0000-0000-000000000014"), Name = "Ketepatan Tata Laksana EWS", Code = "NSI-EWS", CategoryId = catMonitor, AuditType = "NSI", MeasurementType = "YesNo", TargetPercentage = 100, SortOrder = 14, IsActive = true },

            // Category 5: Project Improvement IGD
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da00000f-0000-0000-0000-000000000015"), Name = "Door to ECG ≤ 10 menit", Code = "PI-ECG", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 10, TargetPercentage = 100, SortOrder = 15, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000010-0000-0000-0000-000000000016"), Name = "Door to CT Scan ≤ 25 menit", Code = "PI-CT", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 25, TargetPercentage = 100, SortOrder = 16, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000011-0000-0000-0000-000000000017"), Name = "Door to Analgetic ≤ 60 menit", Code = "PI-ANALGESIC", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 17, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000012-0000-0000-0000-000000000018"), Name = "Door to Initial Diagnosis ≤ 60 menit", Code = "PI-DIAGNOSIS", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 18, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000013-0000-0000-0000-000000000019"), Name = "Door to Antibiotics ≤ 60 menit", Code = "PI-ANTIBIOTICS", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 60, TargetPercentage = 100, SortOrder = 19, IsActive = true },
            new AegisMed.Core.Entities.NsiIndicator { Id = new Guid("da000014-0000-0000-0000-000000000020"), Name = "Responsiveness Maternal Emergency ≤ 5 menit", Code = "PI-MATERNAL", CategoryId = catProjIGD, AuditType = "ProjectImprovement", MeasurementType = "TimeBased", TargetMinutes = 5, TargetPercentage = 100, SortOrder = 20, IsActive = true }
        };
        context.NsiIndicators.AddRange(indicators);
        context.SaveChanges();
        Console.WriteLine($"Seeded {indicators.Length} NsiIndicators.");
    }

    // Seed AppUsers if empty
    if (!context.AppUsers.Any())
    {
        Console.WriteLine("Seeding AppUsers...");
        var site1 = context.HospitalSites.First().Id;
        var roleAdmin = context.AppRoles.First(r => r.Name == "Admin").Id;
        var rolePSQO = context.AppRoles.First(r => r.Name == "PSQO").Id;
        var roleKanit = context.AppRoles.First(r => r.Name == "Kanit").Id;
        var roleKadeptNQ = context.AppRoles.First(r => r.Name == "KadeptNQ").Id;
        var roleNQCorp = context.AppRoles.First(r => r.Name == "NQCorp").Id;
        var igdUnit = context.HospitalUnits.FirstOrDefault(u => u.HospitalSiteId == site1 && u.Code == "IGD")?.Id;

        // BCrypt hash of "Admin@123" and "User@123"
        var adminHash = "$2a$11$K2x0hR6LZMFOD4VQ3gNZkeNElPGrJCnVq1VZ3c1SyBZz0q.2Z3Ydy";
        var userHash  = "$2a$11$K2x0hR6LZMFOD4VQ3gNZkeNElPGrJCnVq1VZ3c1SyBZz0q.2Z3Ydy";

        var users = new[]
        {
            new AegisMed.Core.Entities.AppUser
            {
                Id = new Guid("ad000001-0000-0000-0000-000000000001"),
                FullName = "System Administrator",
                Email = "admin@aegismed.id",
                Username = "admin",
                PasswordHash = adminHash,
                RoleId = roleAdmin,
                HospitalSiteId = site1,
                HospitalUnitId = null,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            },
            new AegisMed.Core.Entities.AppUser
            {
                Id = new Guid("ad000002-0000-0000-0000-000000000002"),
                FullName = "Fitrianti (NQ Corporate)",
                Email = "fitrianti@aegismed.id",
                Username = "fitrianti",
                PasswordHash = userHash,
                RoleId = roleNQCorp,
                HospitalSiteId = site1,
                HospitalUnitId = null,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            },
            new AegisMed.Core.Entities.AppUser
            {
                Id = new Guid("ad000003-0000-0000-0000-000000000003"),
                FullName = "Siti Rahma (Kadept NQ MHJS)",
                Email = "siti.rahma@aegismed.id",
                Username = "kadept.mhjs",
                PasswordHash = userHash,
                RoleId = roleKadeptNQ,
                HospitalSiteId = site1,
                HospitalUnitId = null,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            },
            new AegisMed.Core.Entities.AppUser
            {
                Id = new Guid("ad000004-0000-0000-0000-000000000004"),
                FullName = "Budi Santoso (Kanit IGD MHJS)",
                Email = "budi.santoso@aegismed.id",
                Username = "kanit.igd",
                PasswordHash = userHash,
                RoleId = roleKanit,
                HospitalSiteId = site1,
                HospitalUnitId = igdUnit,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            },
            new AegisMed.Core.Entities.AppUser
            {
                Id = new Guid("ad000005-0000-0000-0000-000000000005"),
                FullName = "Dewi Lestari (PSQO IGD MHJS)",
                Email = "dewi.lestari@aegismed.id",
                Username = "psqo.igd",
                PasswordHash = userHash,
                RoleId = rolePSQO,
                HospitalSiteId = site1,
                HospitalUnitId = igdUnit,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            }
        };

        context.AppUsers.AddRange(users);
        context.SaveChanges();
        Console.WriteLine($"Seeded {users.Length} sample AppUsers.");
    }

    // Seed Authentic NSI Clinical Raw Data Submissions with DIVERSE APPROVAL STATUSES
    Console.WriteLine("Seeding authentic NSI Clinical Audit Submissions with realistic multi-level approval statuses...");
    var oldH = context.ApprovalHistories.Where(h => h.EntityType == "NsiAudit").ToList();
    if (oldH.Any()) context.ApprovalHistories.RemoveRange(oldH);

    var oldS = context.NsiAuditSubmissions.Include(s => s.Items).ToList();
    if (oldS.Any()) context.NsiAuditSubmissions.RemoveRange(oldS);
    context.SaveChanges();

    var auditSiteId = context.HospitalSites.First().Id;
    var psqoUser = context.AppUsers.First(u => u.Username == "psqo.igd").Id;
    var kanitUser = context.AppUsers.First(u => u.Username == "kanit.igd").Id;
    var kadeptUser = context.AppUsers.First(u => u.Username == "kadept.mhjs").Id;
    var corpUser = context.AppUsers.First(u => u.Username == "admin").Id;

    var auditIgdUnit = context.HospitalUnits.First(u => u.HospitalSiteId == auditSiteId && u.Code == "IGD").Id;
    var auditRiUnit = context.HospitalUnits.First(u => u.HospitalSiteId == auditSiteId && u.Code == "RI").Id;
    var auditIcuUnit = context.HospitalUnits.First(u => u.HospitalSiteId == auditSiteId && u.Code == "ICU").Id;

    var allIndicators = context.NsiIndicators.ToList();
    var submissionsToAdd = new List<AegisMed.Core.Entities.NsiAuditSubmission>();
    var historiesToAdd = new List<AegisMed.Core.Entities.ApprovalHistory>();

    // 1. Indikator NSI-NCP: Buat 5 Pasien masing-masing sebagai Raw Data Submission mandiri (No Batch)
    var ncpInd = allIndicators.FirstOrDefault(i => i.Code == "NSI-NCP");
    if (ncpInd != null)
    {
        // Pasien 1: Tn. Gunadi (RI) -> Status: Submitted (Menunggu L1 / PSQO)
        var s1Id = Guid.NewGuid();
        var s1 = new AegisMed.Core.Entities.NsiAuditSubmission
        {
            Id = s1Id,
            HospitalUnitId = auditRiUnit,
            NsiIndicatorId = ncpInd.Id,
            SubmissionMonth = "2026-10",
            AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22), DateTimeKind.Utc),
            Status = AegisMed.Core.Entities.AuditStatus.Submitted,
            SubmittedById = psqoUser,
            SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 30, 0), DateTimeKind.Utc),
            Denominator = 1,
            Numerator = 1,
            AchievementRate = 100.0,
            CreatedDate = DateTime.UtcNow
        };
        s1.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
        {
            Id = Guid.NewGuid(),
            SubmissionId = s1Id,
            ItemNumber = 1,
            PatientIdentifier = "102941",
            IsCompliant = true,
            Notes = "Sesuai SPO asuhan keperawatan IPD",
            CustomFieldsJson = "{\"patientName\":\"Tn. Gunadi\",\"diagnosis\":\"Batu Ureter distal kanan Hidronefrosis sedang Ginjal Kanan\",\"roomArrivalTime\":\"06/01/2025 09:30\",\"ncpCreatedTime\":\"06/01/2025 11:30\",\"ncpCount\":2,\"ncpDiagnosis\":\"1. Nyeri\\n2. Gangguan eliminasi\",\"isNcpCompliant\":true,\"isNcpUnder7h\":true,\"auditorName\":\"maria\",\"verifierName\":\"Menunggu L1 (PSQO)\"}"
        });
        submissionsToAdd.Add(s1);
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s1Id,
            FromStatus = "Draft",
            ToStatus = "Submitted",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 30, 0), DateTimeKind.Utc),
            Notes = "Raw data pasien diajukan oleh PIC Mutu Unit RI"
        });

        // Pasien 2: Tn. xyz (RI) -> Status: Submitted (Menunggu L1 / PSQO) - Non-Compliant
        var s1bId = Guid.NewGuid();
        var s1b = new AegisMed.Core.Entities.NsiAuditSubmission
        {
            Id = s1bId,
            HospitalUnitId = auditRiUnit,
            NsiIndicatorId = ncpInd.Id,
            SubmissionMonth = "2026-10",
            AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22), DateTimeKind.Utc),
            Status = AegisMed.Core.Entities.AuditStatus.Submitted,
            SubmittedById = psqoUser,
            SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 45, 0), DateTimeKind.Utc),
            Denominator = 1,
            Numerator = 0,
            AchievementRate = 0.0,
            CreatedDate = DateTime.UtcNow
        };
        s1b.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
        {
            Id = Guid.NewGuid(),
            SubmissionId = s1bId,
            ItemNumber = 1,
            PatientIdentifier = "102942",
            IsCompliant = false,
            Notes = "Pembuatan NCP melebihi batas waktu 7 jam",
            CustomFieldsJson = "{\"patientName\":\"Tn. xyz\",\"diagnosis\":\"Hipertensi Kronis\",\"roomArrivalTime\":\"08/01/2025 12:00\",\"ncpCreatedTime\":\"09/01/2025 14:00\",\"ncpCount\":1,\"ncpDiagnosis\":\"Gangguan Eliminasi\",\"isNcpCompliant\":false,\"isNcpUnder7h\":false,\"auditorName\":\"Ns. Indri\",\"verifierName\":\"Menunggu L1 (PSQO)\"}"
        });
        submissionsToAdd.Add(s1b);
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s1bId,
            FromStatus = "Draft",
            ToStatus = "Submitted",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 45, 0), DateTimeKind.Utc),
            Notes = "Raw data pasien diajukan oleh PIC Mutu Unit RI"
        });

        // Pasien 3: Ny. Ratna Dewi (ICU) -> Status: ApprovedL1 (Menunggu L2 / Kanit)
        var s2Id = Guid.NewGuid();
        var s2 = new AegisMed.Core.Entities.NsiAuditSubmission
        {
            Id = s2Id,
            HospitalUnitId = auditIcuUnit,
            NsiIndicatorId = ncpInd.Id,
            SubmissionMonth = "2026-10",
            AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21), DateTimeKind.Utc),
            Status = AegisMed.Core.Entities.AuditStatus.ApprovedL1,
            SubmittedById = psqoUser,
            SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 14, 0, 0), DateTimeKind.Utc),
            ApprovedById = psqoUser,
            ApprovedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 16, 30, 0), DateTimeKind.Utc),
            Denominator = 1,
            Numerator = 1,
            AchievementRate = 100.0,
            CreatedDate = DateTime.UtcNow
        };
        s2.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
        {
            Id = Guid.NewGuid(),
            SubmissionId = s2Id,
            ItemNumber = 1,
            PatientIdentifier = "103011",
            IsCompliant = true,
            Notes = "NCP ICU tepat waktu < 2 jam setelah masuk",
            CustomFieldsJson = "{\"patientName\":\"Ny. Ratna Dewi\",\"diagnosis\":\"Post Craniotomy Evakuasi SDH Hari Ke-2\",\"roomArrivalTime\":\"21/10/2026 09:00\",\"ncpCreatedTime\":\"21/10/2026 11:00\",\"ncpCount\":2,\"ncpDiagnosis\":\"1. Penurunan Kapasitas Adaptif Intrakranial\\n2. Pola Nafas Tidak Efektif\",\"isNcpCompliant\":true,\"isNcpUnder7h\":true,\"auditorName\":\"Ns. Siti\",\"verifierName\":\"Menunggu L2 (Kanit)\"}"
        });
        submissionsToAdd.Add(s2);
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s2Id,
            FromStatus = "Draft",
            ToStatus = "Submitted",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 14, 0, 0), DateTimeKind.Utc),
            Notes = "Audit raw data ICU diajukan oleh PIC Mutu"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s2Id,
            FromStatus = "Submitted",
            ToStatus = "ApprovedL1",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 16, 30, 0), DateTimeKind.Utc),
            Notes = "Validasi L1 PSQO: Dokumentasi diagnosa dan waktu sesuai SPO ICU"
        });

        // Pasien 4: Tn. Hendra Saputra (Bedah) -> Status: ApprovedL2 (Menunggu L3 / Kadept NQ)
        var s3Id = Guid.NewGuid();
        var s3 = new AegisMed.Core.Entities.NsiAuditSubmission
        {
            Id = s3Id,
            HospitalUnitId = auditRiUnit,
            NsiIndicatorId = ncpInd.Id,
            SubmissionMonth = "2026-10",
            AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20), DateTimeKind.Utc),
            Status = AegisMed.Core.Entities.AuditStatus.ApprovedL2,
            SubmittedById = psqoUser,
            SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20, 10, 15, 0), DateTimeKind.Utc),
            ApprovedById = kanitUser,
            ApprovedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 9, 30, 0), DateTimeKind.Utc),
            Denominator = 1,
            Numerator = 1,
            AchievementRate = 100.0,
            CreatedDate = DateTime.UtcNow
        };
        s3.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
        {
            Id = Guid.NewGuid(),
            SubmissionId = s3Id,
            ItemNumber = 1,
            PatientIdentifier = "103155",
            IsCompliant = true,
            Notes = "Perencanaan asuhan bedah lengkap",
            CustomFieldsJson = "{\"patientName\":\"Tn. Hendra Saputra\",\"diagnosis\":\"Appendicitis Akut Perforasi Post Laparotomi\",\"roomArrivalTime\":\"20/10/2026 07:30\",\"ncpCreatedTime\":\"20/10/2026 12:00\",\"ncpCount\":2,\"ncpDiagnosis\":\"1. Nyeri Akut\\n2. Risiko Infeksi Area Bedah\",\"isNcpCompliant\":true,\"isNcpUnder7h\":true,\"auditorName\":\"maria\",\"verifierName\":\"Menunggu L3 (Kadept NQ)\"}"
        });
        submissionsToAdd.Add(s3);
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s3Id,
            FromStatus = "Draft",
            ToStatus = "Submitted",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20, 10, 15, 0), DateTimeKind.Utc),
            Notes = "Audit Bedah diajukan oleh maria (PIC)"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s3Id,
            FromStatus = "Submitted",
            ToStatus = "ApprovedL1",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20, 13, 0, 0), DateTimeKind.Utc),
            Notes = "Validasi PSQO disetujui"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s3Id,
            FromStatus = "ApprovedL1",
            ToStatus = "ApprovedL2",
            ActionById = kanitUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 21, 9, 30, 0), DateTimeKind.Utc),
            Notes = "Disetujui Kanit Bedah (Budi Santoso): Tindakan keperawatan sesuai rencana intervensi"
        });

        // Pasien 5: An. Kevin Pratama (Pediatrik) -> Status: Verified (Terverifikasi Kadept NQ)
        var s4Id = Guid.NewGuid();
        var s4 = new AegisMed.Core.Entities.NsiAuditSubmission
        {
            Id = s4Id,
            HospitalUnitId = auditRiUnit,
            NsiIndicatorId = ncpInd.Id,
            SubmissionMonth = "2026-10",
            AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 19), DateTimeKind.Utc),
            Status = AegisMed.Core.Entities.AuditStatus.Verified,
            SubmittedById = psqoUser,
            SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 19, 8, 0, 0), DateTimeKind.Utc),
            ApprovedById = kadeptUser,
            ApprovedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20, 10, 0, 0), DateTimeKind.Utc),
            Denominator = 1,
            Numerator = 1,
            AchievementRate = 100.0,
            CreatedDate = DateTime.UtcNow
        };
        s4.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
        {
            Id = Guid.NewGuid(),
            SubmissionId = s4Id,
            ItemNumber = 1,
            PatientIdentifier = "103289",
            IsCompliant = true,
            Notes = "Dokumentasi keperawatan anak terverifikasi",
            CustomFieldsJson = "{\"patientName\":\"An. Kevin Pratama\",\"diagnosis\":\"Bronkopneumonia + Dehidrasi Sedang\",\"roomArrivalTime\":\"19/10/2026 06:30\",\"ncpCreatedTime\":\"19/10/2026 08:30\",\"ncpCount\":2,\"ncpDiagnosis\":\"1. Bersihan Jalan Nafas Tidak Efektif\\n2. Hipovolemia\",\"isNcpCompliant\":true,\"isNcpUnder7h\":true,\"auditorName\":\"maria\",\"verifierName\":\"Terverifikasi (Kadept NQ)\"}"
        });
        submissionsToAdd.Add(s4);
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s4Id,
            FromStatus = "Draft",
            ToStatus = "Submitted",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 19, 8, 0, 0), DateTimeKind.Utc),
            Notes = "Audit Pediatrik diajukan oleh maria (PIC)"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s4Id,
            FromStatus = "Submitted",
            ToStatus = "ApprovedL1",
            ActionById = psqoUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 19, 11, 0, 0), DateTimeKind.Utc),
            Notes = "Validasi PSQO selesai"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s4Id,
            FromStatus = "ApprovedL1",
            ToStatus = "ApprovedL2",
            ActionById = kanitUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 19, 15, 30, 0), DateTimeKind.Utc),
            Notes = "Approve Kanit selesai"
        });
        historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
        {
            Id = Guid.NewGuid(),
            EntityType = "NsiAudit",
            EntityId = s4Id,
            FromStatus = "ApprovedL2",
            ToStatus = "Verified",
            ActionById = kadeptUser,
            ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 20, 10, 0, 0), DateTimeKind.Utc),
            Notes = "Diverifikasi dan disetujui Kadept Nursing Quality (Siti Rahma)"
        });
    }

    // 2. Indikator Lainnya: Setiap observasi adalah 1 Pasien (No Batch, Denominator = 1)
    int indCounter = 0;
    foreach (var ind in allIndicators.Where(i => i.Code != "NSI-NCP"))
    {
        indCounter++;
        var targetUnit = (ind.Code == "NSI-VITAL" || ind.Code == "NSI-PAIN") ? auditRiUnit : (ind.AuditType == "ProjectImprovement" ? auditIgdUnit : auditRiUnit);
        
        // Buat 2 pasien mandiri per indikator: Pasien A (Compliant) dan Pasien B (Non-Compliant)
        for (int p = 1; p <= 2; p++)
        {
            var subId = Guid.NewGuid();
            bool isCompliant = (p == 1);
            
            // Variasikan status approval
            AegisMed.Core.Entities.AuditStatus currentStatus;
            string currentVerifierText;
            if ((indCounter + p) % 4 == 1)
            {
                currentStatus = AegisMed.Core.Entities.AuditStatus.Submitted;
                currentVerifierText = "Menunggu L1 (PSQO)";
            }
            else if ((indCounter + p) % 4 == 2)
            {
                currentStatus = AegisMed.Core.Entities.AuditStatus.ApprovedL1;
                currentVerifierText = "Menunggu L2 (Kanit)";
            }
            else if ((indCounter + p) % 4 == 3)
            {
                currentStatus = AegisMed.Core.Entities.AuditStatus.ApprovedL2;
                currentVerifierText = "Menunggu L3 (Kadept NQ)";
            }
            else
            {
                currentStatus = AegisMed.Core.Entities.AuditStatus.Verified;
                currentVerifierText = "Terverifikasi (Kadept NQ)";
            }

            var sub = new AegisMed.Core.Entities.NsiAuditSubmission
            {
                Id = subId,
                HospitalUnitId = targetUnit,
                NsiIndicatorId = ind.Id,
                SubmissionMonth = "2026-10",
                AuditDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22), DateTimeKind.Utc),
                Status = currentStatus,
                SubmittedById = psqoUser,
                SubmittedDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 30 + p * 10, 0), DateTimeKind.Utc),
                ApprovedById = currentStatus >= AegisMed.Core.Entities.AuditStatus.ApprovedL1 ? (currentStatus == AegisMed.Core.Entities.AuditStatus.Verified ? kadeptUser : kanitUser) : null,
                ApprovedDate = currentStatus >= AegisMed.Core.Entities.AuditStatus.ApprovedL1 ? DateTime.SpecifyKind(new DateTime(2026, 10, 22, 10, 0, 0), DateTimeKind.Utc) : null,
                Denominator = 1,
                Numerator = isCompliant ? 1 : 0,
                AchievementRate = isCompliant ? 100.0 : 0.0,
                CreatedDate = DateTime.UtcNow
            };

            // Histories
            historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
            {
                Id = Guid.NewGuid(),
                EntityType = "NsiAudit",
                EntityId = subId,
                FromStatus = "Draft",
                ToStatus = "Submitted",
                ActionById = psqoUser,
                ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 30 + p * 10, 0), DateTimeKind.Utc),
                Notes = $"Raw data pasien diajukan oleh PIC Unit"
            });

            if (currentStatus >= AegisMed.Core.Entities.AuditStatus.ApprovedL1)
            {
                historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
                {
                    Id = Guid.NewGuid(),
                    EntityType = "NsiAudit",
                    EntityId = subId,
                    FromStatus = "Submitted",
                    ToStatus = "ApprovedL1",
                    ActionById = psqoUser,
                    ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 9, 30, 0), DateTimeKind.Utc),
                    Notes = "Validasi L1 PSQO disetujui"
                });
            }
            if (currentStatus >= AegisMed.Core.Entities.AuditStatus.ApprovedL2)
            {
                historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
                {
                    Id = Guid.NewGuid(),
                    EntityType = "NsiAudit",
                    EntityId = subId,
                    FromStatus = "ApprovedL1",
                    ToStatus = "ApprovedL2",
                    ActionById = kanitUser,
                    ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 11, 0, 0), DateTimeKind.Utc),
                    Notes = "Approve L2 Kanit disetujui"
                });
            }
            if (currentStatus == AegisMed.Core.Entities.AuditStatus.Verified)
            {
                historiesToAdd.Add(new AegisMed.Core.Entities.ApprovalHistory
                {
                    Id = Guid.NewGuid(),
                    EntityType = "NsiAudit",
                    EntityId = subId,
                    FromStatus = "ApprovedL2",
                    ToStatus = "Verified",
                    ActionById = kadeptUser,
                    ActionDate = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 13, 0, 0), DateTimeKind.Utc),
                    Notes = "Verifikasi dan persetujuan final Kadept Nursing Quality (Siti Rahma)"
                });
            }

            // Tepat 1 Pasien per Submission (Items.Count == 1)
            if (ind.Code == "NSI-RNC")
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "7022" : "7045",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Respons bel cepat dalam 2 menit" : "Petugas sedang melakukan resusitasi bed sebelah",
                    CustomFieldsJson = $"{{\"roomNumber\":\"{(p == 1 ? "7022" : "7045")}\",\"patientName\":\"{(p == 1 ? "Tn. Pratama" : "Tn. Basuki")}\",\"callTime\":\"12:10:00\",\"responseTime\":\"{(p == 1 ? "12:12:00" : "12:15:00")}\",\"durationMinutes\":{(p == 1 ? 2 : 5)},\"durationText\":\"{(p == 1 ? "00:02:00" : "00:05:00")}\",\"observerName\":\"Ns A\",\"validatorName\":\"Ns. X\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.CategoryId == new Guid("ca000002-0000-0000-0000-000000000002"))
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "12345678" : "12345679",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Lengkap dan diautentifikasi dengan benar" : "Tulisan sulit terbaca pada lembar asesmen",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Agnes Monica" : "Bambang S.")}\",\"criteriaAda\":true,\"criteriaTepatWaktu\":true,\"criteriaDapatDibaca\":{isCompliant.ToString().ToLower()},\"criteriaAutentikasi\":true,\"criteriaLengkap\":true,\"isNa\":false,\"scorePercentage\":{(isCompliant ? 100 : 80)},\"auditorName\":\"Dewi Lestari\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.Code == "NSI-EDUKASI")
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "454646" : "424324",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Seluruh 6 materi edukasi diberikan dan ditandatangani keluarga" : "Hanya edukasi perawatan luka yang diberikan",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Ny Nani" : "Tn Ali")}\",\"eduOrientasi\":{(isCompliant ? 1 : 0)},\"eduJatuh\":{(isCompliant ? 1 : 0)},\"eduPlebitis\":{(isCompliant ? 1 : 0)},\"eduCuciTangan\":{(isCompliant ? 1 : 0)},\"eduLuka\":1,\"eduDischarge\":{(isCompliant ? 1 : 0)},\"auditorName\":\"maria\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.Code == "NSI-VITAL")
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "11223344" : "11223345",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Monitoring ulang TTV dilakukan tepat waktu 15 menit pasca tindakan" : "Terlambat melakukan monitoring ulang jam ke-2",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Ny. Imelda" : "Tn. Santoso")}\",\"patientCriteria\":\"{(p == 1 ? "Post Tindakan" : "Post Kemoterapi")}\",\"arrivalTime\":\"{(p == 1 ? "15.30" : "14:00")}\",\"isTtvOnTime\":{(isCompliant ? 1 : 0)},\"auditorName\":\"maria\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.Code == "NSI-PAIN")
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "11223344" : "11223345",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Evaluasi nyeri lengkap sesuai SPO" : "Evaluasi post analgetik belum dicatat dalam rekam medis",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Ny. Imelda" : "Tn. Santoso")}\",\"hasRoutineIvAnalgesic\":\"{(p == 1 ? "Ya" : "Tidak")}\",\"painCategory\":\"Sedang\",\"medicationName\":\"{(p == 1 ? "Remopain IV" : "Tramal Supp")}\",\"isPostEvaluationCompliant\":{(isCompliant ? 1 : 0)},\"isReassessmentCompliant\":1,\"auditorName\":\"maria\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.Code == "NSI-EWS")
            {
                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "112234" : "112233",
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? "Eskalasi monitoring dan dokumentasi CPPT lengkap" : "Pelaporan ke DPJP belum tertulis di lembar CPPT",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Tn. Surya" : "Tn. Budi")}\",\"ewsMonitorTime\":\"10:00\",\"ewsScore\":4,\"ewsReportTime\":\"10:10\",\"isFreqEscalated\":1,\"isActionAppropriate\":1,\"isCpptDocumented\":{(isCompliant ? 1 : 0)},\"auditorName\":\"Ns. A\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }
            else if (ind.AuditType == "ProjectImprovement")
            {
                var targetMins = (int)(ind.TargetMinutes ?? 10);
                var door1 = DateTime.SpecifyKind(new DateTime(2026, 10, 22, 8, 0, 0), DateTimeKind.Utc);
                var actualMins = isCompliant ? targetMins : targetMins + 2;
                var event1 = door1.AddMinutes(actualMins);
                var event1Str = event1.ToString("HH:mm:ss");

                sub.Items.Add(new AegisMed.Core.Entities.NsiAuditItem
                {
                    Id = Guid.NewGuid(),
                    SubmissionId = subId,
                    ItemNumber = 1,
                    PatientIdentifier = p == 1 ? "11223344" : "11223355",
                    DoorTime = door1,
                    EventTime = event1,
                    MinutesElapsed = actualMins,
                    IsCompliant = isCompliant,
                    Notes = isCompliant ? $"Tercapai dalam batas {targetMins} menit" : "Antrean alat tindakan di ruang resusitasi IGD",
                    CustomFieldsJson = $"{{\"patientName\":\"{(p == 1 ? "Tn. Hartono" : "Ny. Sumarni")}\",\"doorTime\":\"08:00:00\",\"eventTime\":\"{event1Str}\",\"minutesElapsed\":{actualMins},\"isCompliant\":{isCompliant.ToString().ToLower()},\"auditorName\":\"Ns. Dewi\",\"verifierName\":\"{currentVerifierText}\"}}"
                });
            }

            submissionsToAdd.Add(sub);
        }
    }

    context.NsiAuditSubmissions.AddRange(submissionsToAdd);
    context.ApprovalHistories.AddRange(historiesToAdd);
    context.SaveChanges();
    Console.WriteLine($"Seeded {submissionsToAdd.Count} authentic NSI Audit Submissions with realistic multi-level statuses (Submitted, ApprovedL1, ApprovedL2, Verified) and {historiesToAdd.Count} ApprovalHistories.");

    // Seed Additional ED Case Submissions for All Sites, Respon Bidan, and Months 2026-06 to 2026-10
    var indMaternal = new Guid("a5555555-a555-a555-a555-a55555555555");
    var indCardiology = new Guid("a0000000-a000-a000-a000-a00000000000");
    var indOrthopaedics = new Guid("a1111111-a111-a111-a111-a11111111111");
    var indNeurology = new Guid("a2222222-a222-a222-a222-a22222222222");
    var indGastro = new Guid("a3333333-a333-a333-a333-a33333333333");
    var indOncology = new Guid("a4444444-a444-a444-a444-a44444444444");

    if (!context.EdCaseSubmissions.Any(e => e.EdIndicatorId == indMaternal))
    {
        Console.WriteLine("Seeding additional ED Case Submissions across all sites and months...");
        var edList = new List<AegisMed.Core.Entities.EdCaseSubmission>();
        var sitesList = context.HospitalSites.ToList();
        var rnd = new Random(42);

        var months = new[] { "2026-06", "2026-07", "2026-08", "2026-09", "2026-10" };
        int caseNum = 5000;

        foreach (var site in sitesList)
        {
            foreach (var m in months)
            {
                var year = int.Parse(m.Substring(0, 4));
                var mon = int.Parse(m.Substring(5, 2));

                // Maternal / Bidan
                var bTime = rnd.Next(2, 6);
                edList.Add(new AegisMed.Core.Entities.EdCaseSubmission
                {
                    Id = Guid.NewGuid(),
                    EmrNumber = $"EMR-{caseNum++}",
                    PatientInitials = "Ny. " + ((char)('A' + rnd.Next(0, 26))),
                    SubmissionMonth = m,
                    EdIndicatorId = indMaternal,
                    DoorTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 10, 0, 0), DateTimeKind.Utc),
                    EventTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 10, bTime, 0), DateTimeKind.Utc),
                    MinutesElapsed = bTime,
                    IsCompliant = bTime <= 5,
                    ClinicalNotes = "G3P2A0 Hamil aterm inpartu kala 1, respon bidan cepat sesuai SPO.",
                    CustomFieldsJson = "{\"GestationalAge\":\"38-39 minggu\",\"MidwifeName\":\"Bdn. Siti\"}",
                    HospitalSiteId = site.Id,
                    Status = AegisMed.Core.Entities.AuditStatus.ApprovedL1
                });

                // ECG
                var ecgTime = rnd.Next(5, 13);
                edList.Add(new AegisMed.Core.Entities.EdCaseSubmission
                {
                    Id = Guid.NewGuid(),
                    EmrNumber = $"EMR-{caseNum++}",
                    PatientInitials = "Tn. " + ((char)('A' + rnd.Next(0, 26))),
                    SubmissionMonth = m,
                    EdIndicatorId = indCardiology,
                    DoorTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 14, 0, 0), DateTimeKind.Utc),
                    EventTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 14, ecgTime, 0), DateTimeKind.Utc),
                    MinutesElapsed = ecgTime,
                    IsCompliant = ecgTime <= 10,
                    ClinicalNotes = ecgTime <= 10 ? "Nyeri dada retrosternal, rekam EKG 12 lead tercapai." : "Antrean mesin EKG cadangan di resusitasi.",
                    CustomFieldsJson = "{}",
                    HospitalSiteId = site.Id,
                    Status = AegisMed.Core.Entities.AuditStatus.Submitted
                });

                // CT/MRI
                var ctTime = rnd.Next(16, 29);
                edList.Add(new AegisMed.Core.Entities.EdCaseSubmission
                {
                    Id = Guid.NewGuid(),
                    EmrNumber = $"EMR-{caseNum++}",
                    PatientInitials = "Tn. " + ((char)('A' + rnd.Next(0, 26))),
                    SubmissionMonth = m,
                    EdIndicatorId = indNeurology,
                    DoorTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 16, 0, 0), DateTimeKind.Utc),
                    EventTime = DateTime.SpecifyKind(new DateTime(year, mon, rnd.Next(1, 28), 16, ctTime, 0), DateTimeKind.Utc),
                    MinutesElapsed = ctTime,
                    IsCompliant = ctTime <= 25,
                    ClinicalNotes = ctTime <= 25 ? "FAST positif, code stroke diaktifkan, CT scan non-kontras tepat waktu." : "Pasien gelisah, persiapan radiologi memerlukan pendampingan.",
                    CustomFieldsJson = "{\"MedicalDiagnosis\":\"Stroke Iskemik Akut\",\"RadiologyAction\":\"CT Scan Kepala Non-Kontras\"}",
                    HospitalSiteId = site.Id,
                    Status = AegisMed.Core.Entities.AuditStatus.Verified
                });
            }
        }

        context.EdCaseSubmissions.AddRange(edList);
        context.SaveChanges();
        Console.WriteLine($"Seeded {edList.Count} additional ED Cases across all sites and months.");
    }

    // Seed NSI historical trends for 2026-07, 2026-08, 2026-09
    var monthsNsi = new[] { "2026-07", "2026-08", "2026-09" };
    var existingMonths = context.NsiAuditSubmissions.Select(s => s.SubmissionMonth).Distinct().ToList();
    var extraNsi = new List<AegisMed.Core.Entities.NsiAuditSubmission>();
    var auditRiUnits = context.HospitalUnits.Where(u => u.Code == "RI" || u.Code == "ICU").ToList();

    foreach (var m in monthsNsi)
    {
        if (!existingMonths.Contains(m))
        {
            var year = int.Parse(m.Substring(0, 4));
            var mon = int.Parse(m.Substring(5, 2));

            foreach (var ind in allIndicators.Where(i => i.AuditType == "NSI"))
            {
                var targetUnit = auditRiUnits.FirstOrDefault()?.Id ?? auditRiUnit;
                var den = 10;
                var num = m == "2026-07" ? 8 : (m == "2026-08" ? 9 : 8);
                extraNsi.Add(new AegisMed.Core.Entities.NsiAuditSubmission
                {
                    Id = Guid.NewGuid(),
                    HospitalUnitId = targetUnit,
                    NsiIndicatorId = ind.Id,
                    SubmissionMonth = m,
                    AuditDate = DateTime.SpecifyKind(new DateTime(year, mon, 20), DateTimeKind.Utc),
                    Status = AegisMed.Core.Entities.AuditStatus.Verified,
                    Denominator = den,
                    Numerator = num,
                    AchievementRate = (double)num * 100.0 / den,
                    CreatedDate = DateTime.UtcNow
                });
            }
        }
    }
    if (extraNsi.Any())
    {
        context.NsiAuditSubmissions.AddRange(extraNsi);
        context.SaveChanges();
        Console.WriteLine($"Seeded {extraNsi.Count} historical NSI submissions for months 2026-07, 2026-08, 2026-09.");
    }

    Console.WriteLine($"Final DB State: Roles={context.AppRoles.Count()}, Users={context.AppUsers.Count()}, Units={context.HospitalUnits.Count()}, Indicators={context.NsiIndicators.Count()}, Submissions={context.NsiAuditSubmissions.Count()}");
}
catch (Exception ex)
{
    Console.WriteLine("Error: " + ex.ToString());
}
