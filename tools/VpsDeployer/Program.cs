using System;
using System.IO;
using System.Threading;
using Renci.SshNet;

string host = "43.134.114.171";
string username = "ubuntu";
string password = "ocean-93@-galaxy";

Console.WriteLine("=========================================================");
Console.WriteLine($"[AEGISMED VPS DEPLOYER] Target: {username}@{host}");
Console.WriteLine("=========================================================\n");

using var client = new SshClient(host, username, password);
client.ConnectionInfo.Timeout = TimeSpan.FromSeconds(30);
client.Connect();
Console.WriteLine("[VPS] SSH Connection Established successfully!\n");

bool Exec(string cmd, bool sudo = false, int timeoutMinutes = 15)
{
    string scriptName = $"/tmp/deploy_step_{Guid.NewGuid():N}.sh";
    
    // Upload or write script
    string header = "#!/bin/bash\nset -e\nexport DEBIAN_FRONTEND=noninteractive\n";
    string fullScript = header + cmd + "\n";

    // Write remote file
    using (var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(fullScript)))
    {
        using var sftp = new SftpClient(host, username, password);
        sftp.Connect();
        sftp.UploadFile(ms, scriptName);
        sftp.Disconnect();
    }

    string execCmd = sudo 
        ? $"echo '{password}' | sudo -S bash {scriptName}" 
        : $"bash {scriptName}";

    Console.WriteLine($"\n>>> [{DateTime.Now:HH:mm:ss}] EXECUTING STEP SCRIPT:");
    using var sshCmd = client.CreateCommand(execCmd);
    sshCmd.CommandTimeout = TimeSpan.FromMinutes(timeoutMinutes);
    var asyncResult = sshCmd.BeginExecute();
    using var reader = new StreamReader(sshCmd.OutputStream);
    using var errReader = new StreamReader(sshCmd.ExtendedOutputStream);

    while (!asyncResult.IsCompleted)
    {
        string? line;
        while ((line = reader.ReadLine()) != null) Console.WriteLine("  " + line);
        while ((line = errReader.ReadLine()) != null) Console.WriteLine("  [ERR] " + line);
        Thread.Sleep(150);
    }
    sshCmd.EndExecute(asyncResult);
    string? rem;
    while ((rem = reader.ReadLine()) != null) Console.WriteLine("  " + rem);
    while ((rem = errReader.ReadLine()) != null) Console.WriteLine("  [ERR] " + rem);

    Console.WriteLine($"--- Exit Code: {sshCmd.ExitStatus} ---");

    // Remove temp script
    using var rmCmd = client.CreateCommand($"rm -f {scriptName}");
    rmCmd.Execute();

    return sshCmd.ExitStatus == 0;
}

try
{
    if (args.Length > 0)
    {
        bool isSudo = args.Length > 1 && args[1] == "--sudo";
        Exec(args[0], sudo: isSudo);
        return;
    }

    Console.WriteLine("STEP 1: Updating packages & cleaning up...");
    Exec("apt-get update && apt-get -y upgrade && apt-get -y autoremove && apt-get clean", sudo: true);

    Console.WriteLine("\nSTEP 2: Installing prerequisites, Git, UFW...");
    Exec("apt-get install -y ca-certificates curl gnupg lsb-release git ufw", sudo: true);

    Console.WriteLine("\nSTEP 3: Installing Docker Engine & Docker Compose...");
    Exec("""
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu
systemctl enable --now docker
docker --version
docker compose version
""", sudo: true);

    Console.WriteLine("\nSTEP 4: Configuring Firewall (UFW)...");
    Exec("""
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo y | ufw enable
ufw status verbose
""", sudo: true);

    Console.WriteLine("\nSTEP 5: Cloning / Updating Repository...");
    Exec("""
if [ -d "/home/ubuntu/aegismed" ]; then
    echo "Repository exists. Pulling latest main..."
    cd /home/ubuntu/aegismed
    git fetch origin
    git reset --hard origin/main
else
    echo "Cloning repository..."
    git clone https://github.com/andyaloys/AegisMed.git /home/ubuntu/aegismed
fi
chown -R ubuntu:ubuntu /home/ubuntu/aegismed
""", sudo: true);

    Console.WriteLine("\nSTEP 6: Building & Launching AegisMed (Database, Backend, Frontend)...");
    Exec("""
cd /home/ubuntu/aegismed
docker compose down || true
docker compose build --no-cache
docker compose up -d
""", sudo: true, timeoutMinutes: 20);

    Console.WriteLine("\nSTEP 7: Checking container status...");
    Thread.Sleep(5000);
    Exec("docker ps -a", sudo: true);

    Console.WriteLine("\nSTEP 8: Seeding Database via DbMigrator inside container...");
    Exec("""
cd /home/ubuntu/aegismed
docker run --rm \
    --network aegismed_default \
    -v /home/ubuntu/aegismed/backend:/src \
    -w /src \
    -e ConnectionStrings__DefaultConnection="Host=db;Database=aegismed_qms_pg;Username=postgres;Password=P@ssw0rd;" \
    mcr.microsoft.com/dotnet/sdk:9.0 \
    dotnet run --project DbMigrator/DbMigrator.csproj
""", sudo: true, timeoutMinutes: 10);

    Console.WriteLine("\nSTEP 9: Verifying Services & Endpoints...");
    Exec("curl -I http://localhost/", sudo: true);
    Exec("curl -s http://localhost/api/auth/users | head -c 200", sudo: true);

    Console.WriteLine("\n=========================================================");
    Console.WriteLine("🚀 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    Console.WriteLine($"Aplikasi AegisMed dapat diakses di: http://{host}/");
    Console.WriteLine("=========================================================");
}
catch (Exception ex)
{
    Console.WriteLine($"\n[FATAL ERROR] {ex.Message}\n{ex.StackTrace}");
}
finally
{
    client.Disconnect();
}
