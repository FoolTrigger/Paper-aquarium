// src/launcher/Program.cs
// Нативный Windows лаунчер для Бумажного Аквариума (Paper Aquarium)
// Компилируется через стандартный csc.exe в автономный PaperAquarium.exe

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PaperAquarium
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Запрет запуска двух копий программы одновременно
            bool isNewInstance;
            using (Mutex mutex = new Mutex(true, "Global\\PaperAquariumSingleInstanceMutex", out isNewInstance))
            {
                if (!isNewInstance)
                {
                    MessageBox.Show(
                        "Бумажный Аквариум уже запущен!\nПроверьте значок в системном трее (возле часов).",
                        "Бумажный Аквариум",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    return;
                }

                Application.Run(new MainForm());
            }
        }
    }

    public class MainForm : Form
    {
        private Process serverProcess;
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private int serverPort = 8000;
        private string localIp = "127.0.0.1";
        private string dataDir = "";
        private bool isClosingExplicitly = false;

        private Label lblStatus;
        private LinkLabel lnkLocal;
        private LinkLabel lnkLan;
        private Button btnOpenBrowser;
        private Button btnOpenData;
        private Button btnExit;

        public MainForm()
        {
            InitializeApp();
        }

        private void InitializeApp()
        {
            this.Text = "Бумажный Аквариум (Paper Aquarium)";
            this.Size = new Size(520, 360);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(10, 22, 36);
            this.ForeColor = Color.White;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string iconPath = Path.Combine(baseDir, "assets", "app-icon.ico");
            if (!File.Exists(iconPath))
            {
                iconPath = Path.Combine(baseDir, "app-icon.ico");
            }

            if (File.Exists(iconPath))
            {
                try { this.Icon = new Icon(iconPath); } catch { }
            }

            // Находим свободный порт
            serverPort = FindAvailablePort(8000);
            localIp = GetLocalIpAddress();

            // Определяем путь к данным для кнопки
            string portableFile = Path.Combine(baseDir, "portable.txt");
            if (File.Exists(portableFile) || Environment.GetEnvironmentVariable("AQUA_PORTABLE") == "1")
            {
                dataDir = Path.Combine(baseDir, "data");
            }
            else
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                dataDir = Path.Combine(appData, "PaperAquarium", "data");
            }

            // Компоненты формы
            BuildControls();

            // Настройка системного трея
            BuildTrayMenu();

            // Запуск локального сервера
            StartServerProcess();

            // Фоновая проверка готовности сервера и запуск браузера
            Thread bgThread = new Thread(WaitForServerAndLaunchBrowser);
            bgThread.IsBackground = true;
            bgThread.Start();
        }

        private void BuildControls()
        {
            // Верхний заголовок с аквариумной темой
            Panel headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 70;
            headerPanel.BackColor = Color.FromArgb(14, 32, 54);

            Label title = new Label();
            title.Text = "🐠 Бумажный Аквариум";
            title.Font = new Font("Segoe UI", 15, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(88, 214, 255);
            title.Location = new Point(18, 12);
            title.AutoSize = true;
            headerPanel.Controls.Add(title);

            lblStatus = new Label();
            lblStatus.Text = "Запуск локального сервера...";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(180, 210, 230);
            lblStatus.Location = new Point(22, 42);
            lblStatus.AutoSize = true;
            headerPanel.Controls.Add(lblStatus);

            this.Controls.Add(headerPanel);

            // Основной контейнер информации
            int top = 88;

            Label lblLocalInfo = new Label();
            lblLocalInfo.Text = "Компьютер (это устройство):";
            lblLocalInfo.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblLocalInfo.ForeColor = Color.FromArgb(200, 230, 255);
            lblLocalInfo.Location = new Point(20, top);
            lblLocalInfo.AutoSize = true;
            this.Controls.Add(lblLocalInfo);

            top += 22;
            lnkLocal = new LinkLabel();
            lnkLocal.Text = "http://localhost:" + serverPort + "/";
            lnkLocal.Font = new Font("Consolas", 11, FontStyle.Bold);
            lnkLocal.LinkColor = Color.FromArgb(88, 214, 255);
            lnkLocal.ActiveLinkColor = Color.White;
            lnkLocal.Location = new Point(22, top);
            lnkLocal.AutoSize = true;
            lnkLocal.LinkClicked += (s, e) => OpenInBrowser();
            this.Controls.Add(lnkLocal);

            top += 34;
            Label lblLanInfo = new Label();
            lblLanInfo.Text = "С телефона или планшета (Wi-Fi):";
            lblLanInfo.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblLanInfo.ForeColor = Color.FromArgb(200, 230, 255);
            lblLanInfo.Location = new Point(20, top);
            lblLanInfo.AutoSize = true;
            this.Controls.Add(lblLanInfo);

            top += 22;
            lnkLan = new LinkLabel();
            lnkLan.Text = "http://" + localIp + ":" + serverPort + "/";
            lnkLan.Font = new Font("Consolas", 11, FontStyle.Bold);
            lnkLan.LinkColor = Color.FromArgb(120, 230, 180);
            lnkLan.ActiveLinkColor = Color.White;
            lnkLan.Location = new Point(22, top);
            lnkLan.AutoSize = true;
            lnkLan.LinkClicked += (s, e) => Process.Start(lnkLan.Text);
            this.Controls.Add(lnkLan);

            Button btnQr = new Button();
            btnQr.Text = "📱 QR-код";
            btnQr.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            btnQr.BackColor = Color.FromArgb(20, 60, 90);
            btnQr.ForeColor = Color.FromArgb(88, 214, 255);
            btnQr.FlatStyle = FlatStyle.Flat;
            btnQr.FlatAppearance.BorderColor = Color.FromArgb(40, 90, 130);
            btnQr.Location = new Point(365, top - 3);
            btnQr.Size = new Size(115, 26);
            btnQr.Cursor = Cursors.Hand;
            btnQr.Click += (s, e) => OpenPhoneQr();
            this.Controls.Add(btnQr);

            Label lblLanHint = new Label();
            lblLanHint.Text = "Откройте этот адрес в браузере телефона, чтобы оживлять раскраски камерой.";
            lblLanHint.Font = new Font("Segoe UI", 8.5f, FontStyle.Italic);
            lblLanHint.ForeColor = Color.FromArgb(140, 165, 185);
            lblLanHint.Location = new Point(22, top + 22);
            lblLanHint.Size = new Size(460, 20);
            this.Controls.Add(lblLanHint);

            // Кнопки управления внизу
            int btnTop = 265;

            btnOpenBrowser = new Button();
            btnOpenBrowser.Text = "Открыть аквариум";
            btnOpenBrowser.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnOpenBrowser.BackColor = Color.FromArgb(0, 150, 220);
            btnOpenBrowser.ForeColor = Color.White;
            btnOpenBrowser.FlatStyle = FlatStyle.Flat;
            btnOpenBrowser.FlatAppearance.BorderSize = 0;
            btnOpenBrowser.Location = new Point(20, btnTop);
            btnOpenBrowser.Size = new Size(155, 34);
            btnOpenBrowser.Cursor = Cursors.Hand;
            btnOpenBrowser.Click += (s, e) => OpenInBrowser();
            this.Controls.Add(btnOpenBrowser);

            btnOpenData = new Button();
            btnOpenData.Text = "Папка данных";
            btnOpenData.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            btnOpenData.BackColor = Color.FromArgb(24, 46, 70);
            btnOpenData.ForeColor = Color.FromArgb(210, 230, 250);
            btnOpenData.FlatStyle = FlatStyle.Flat;
            btnOpenData.FlatAppearance.BorderColor = Color.FromArgb(40, 75, 110);
            btnOpenData.Location = new Point(185, btnTop);
            btnOpenData.Size = new Size(130, 34);
            btnOpenData.Cursor = Cursors.Hand;
            btnOpenData.Click += (s, e) => OpenDataDirectory();
            this.Controls.Add(btnOpenData);

            btnExit = new Button();
            btnExit.Text = "Выход";
            btnExit.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            btnExit.BackColor = Color.FromArgb(24, 46, 70);
            btnExit.ForeColor = Color.FromArgb(255, 150, 150);
            btnExit.FlatStyle = FlatStyle.Flat;
            btnExit.FlatAppearance.BorderColor = Color.FromArgb(60, 35, 45);
            btnExit.Location = new Point(380, btnTop);
            btnExit.Size = new Size(100, 34);
            btnExit.Cursor = Cursors.Hand;
            btnExit.Click += (s, e) => ExitApplication();
            this.Controls.Add(btnExit);
        }

        private void BuildTrayMenu()
        {
            trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("Открыть аквариум", null, (s, e) => OpenInBrowser());
            trayMenu.Items.Add("📱 QR-код для телефона...", null, (s, e) => OpenPhoneQr());
            trayMenu.Items.Add("📋 Скопировать адрес для телефона", null, (s, e) => CopyLanAddress());
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add("Показать окно управления", null, (s, e) => RestoreWindow());
            trayMenu.Items.Add("Папка с данными", null, (s, e) => OpenDataDirectory());
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add("Выход", null, (s, e) => ExitApplication());

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Бумажный Аквариум";
            trayIcon.Icon = this.Icon;
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => OpenInBrowser();
        }

        private void OpenPhoneQr()
        {
            try
            {
                Process.Start("http://localhost:" + serverPort + "/qr");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Не удалось открыть браузер: " + ex.Message, "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void CopyLanAddress()
        {
            try
            {
                Clipboard.SetText("http://" + localIp + ":" + serverPort + "/");
                trayIcon.ShowBalloonTip(1500, "Бумажный Аквариум", "Адрес для телефона скопирован в буфер обмена!", ToolTipIcon.Info);
            }
            catch { }
        }


        private void StartServerProcess()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodeExe = Path.Combine(baseDir, "runtime", "node.exe");

            if (!File.Exists(nodeExe))
            {
                nodeExe = Path.Combine(baseDir, "node.exe");
            }

            if (!File.Exists(nodeExe))
            {
                // Fallback на глобальный node в системе, если есть
                nodeExe = "node";
            }

            string serverScript = Path.Combine(baseDir, "server.js");
            if (!File.Exists(serverScript))
            {
                MessageBox.Show(
                    "Файл server.js не найден в каталоге программы:\n" + baseDir,
                    "Ошибка запуска",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = nodeExe;
            psi.Arguments = "\"" + serverScript + "\"";
            psi.WorkingDirectory = baseDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;

            psi.EnvironmentVariables["PORT"] = serverPort.ToString();
            if (File.Exists(Path.Combine(baseDir, "portable.txt")))
            {
                psi.EnvironmentVariables["AQUA_PORTABLE"] = "1";
            }
            else
            {
                psi.EnvironmentVariables["AQUA_DESKTOP"] = "1";
            }

            try
            {
                serverProcess = new Process();
                serverProcess.StartInfo = psi;
                serverProcess.EnableRaisingEvents = true;
                serverProcess.Exited += (s, e) =>
                {
                    if (!isClosingExplicitly)
                    {
                        this.BeginInvoke((Action)(() =>
                        {
                            lblStatus.Text = "Сервер неожиданно завершил работу.";
                            lblStatus.ForeColor = Color.FromArgb(255, 100, 100);
                        }));
                    }
                };

                serverProcess.Start();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Не удалось запустить сервер:\n" + ex.Message,
                    "Ошибка запуска",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        private void WaitForServerAndLaunchBrowser()
        {
            string testUrl = "http://127.0.0.1:" + serverPort + "/";
            bool ready = false;

            for (int i = 0; i < 40; i++)
            {
                Thread.Sleep(250);
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(testUrl);
                    req.Timeout = 1000;
                    req.Method = "GET";
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        if (resp.StatusCode == HttpStatusCode.OK)
                        {
                            ready = true;
                            break;
                        }
                    }
                }
                catch
                {
                    // ждем готовности сервера
                }
            }

            this.BeginInvoke((Action)(() =>
            {
                if (ready)
                {
                    lblStatus.Text = "● Сервер активен: всё готово к работе";
                    lblStatus.ForeColor = Color.FromArgb(100, 255, 160);

                    // Автоматически открываем браузер при первом старте
                    OpenInBrowser();

                    trayIcon.ShowBalloonTip(
                        3000,
                        "Бумажный Аквариум",
                        "Сервер работает. Нажмите значок для быстрого доступа.",
                        ToolTipIcon.Info
                    );
                }
                else
                {
                    lblStatus.Text = "Сервер долго отвечает. Попробуйте обновить.";
                    lblStatus.ForeColor = Color.FromArgb(255, 200, 100);
                }
            }));
        }

        private void OpenInBrowser()
        {
            try
            {
                Process.Start("http://localhost:" + serverPort + "/");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Не удалось открыть браузер: " + ex.Message);
            }
        }

        private void OpenDataDirectory()
        {
            try
            {
                if (!Directory.Exists(dataDir))
                {
                    Directory.CreateDirectory(dataDir);
                }
                Process.Start("explorer.exe", "\"" + dataDir + "\"");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Не удалось открыть каталог данных:\n" + ex.Message);
            }
        }

        private void RestoreWindow()
        {
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.BringToFront();
        }

        private void ExitApplication()
        {
            isClosingExplicitly = true;
            StopServer();
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            Application.Exit();
        }

        private void StopServer()
        {
            if (serverProcess != null && !serverProcess.HasExited)
            {
                try
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(1500);
                }
                catch { }
                serverProcess = null;
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // При нажатии на крестик окна — спрашиваем или сворачиваем в трей
            if (!isClosingExplicitly && e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
                trayIcon.ShowBalloonTip(
                    2000,
                    "Бумажный Аквариум",
                    "Приложение свернуто в системный трей и продолжает работать.",
                    ToolTipIcon.Info
                );
                return;
            }

            base.OnFormClosing(e);
            StopServer();
        }

        private static int FindAvailablePort(int startingPort)
        {
            for (int port = startingPort; port < startingPort + 100; port++)
            {
                TcpListener listener = null;
                try
                {
                    listener = new TcpListener(IPAddress.Loopback, port);
                    listener.Start();
                    listener.Stop();
                    return port;
                }
                catch
                {
                    // порт занят, пробуем следующий
                }
                finally
                {
                    if (listener != null)
                    {
                        try { listener.Stop(); } catch { }
                    }
                }
            }
            return startingPort;
        }

        private static string GetLocalIpAddress()
        {
            try
            {
                var interfaces = NetworkInterface.GetAllNetworkInterfaces();
                string bestIp = null;
                foreach (var iface in interfaces)
                {
                    if (iface.OperationalStatus == OperationalStatus.Up &&
                        iface.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                    {
                        var ipProps = iface.GetIPProperties();
                        foreach (var addr in ipProps.UnicastAddresses)
                        {
                            if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                            {
                                string ipStr = addr.Address.ToString();
                                if (!ipStr.StartsWith("169.254.") && !ipStr.StartsWith("127."))
                                {
                                    if (iface.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                                    {
                                        return ipStr; // Приоритет: Wi-Fi
                                    }
                                    if (bestIp == null || ipStr.StartsWith("192.168."))
                                    {
                                        bestIp = ipStr;
                                    }
                                }
                            }
                        }
                    }
                }
                if (bestIp != null) return bestIp;
            }
            catch { }
            return "127.0.0.1";
        }

    }
}
