using System;

namespace AegisMed.Core.Entities;

public class EdIndicator
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string TargetDescription { get; set; } = string.Empty;
    public double TargetMinutes { get; set; }
}
