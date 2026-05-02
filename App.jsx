import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, BellRing, Cpu, PlayCircle, AlertCircle, 
  MessageSquare, Mail, Smartphone, ShieldAlert, Activity, 
  HelpCircle, Loader2, Send 
} from 'lucide-react';

// --- 사내 지식 베이스 (Troubleshooting Data) ---
// 문자열 내부의 마크다운 코드 블록 기호(백틱 3개)로 인한 파싱 에러를 방지하기 위해 이스케이프(\`\`\`) 처리 적용
const troubleshootingData = [
  {
    id: "TS-LINUX-001",
    category: "OS / GUI",
    title: "Ubuntu 22.04 XRDP Black Screen & Polkit Crash",
    rootCause: "Default Gnome session conflict with XRDP and overly strict polkit rules blocking non-console users from creating color managed devices.",
    resolution: "Created ~/.xsession with 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'. Added custom polkit .pkla file to allow colord.",
    cliMock: "[ERROR] xrdp_mm_process_login_response: login failed\n$ echo 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session' > ~/.xsession\n$ sudo bash -c 'cat > /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla <<EOF\n[Allow Colord all Users]\nIdentity=unix-user:*\nAction=org.freedesktop.color-manager.create-device\nResultAny=no\nResultInactive=no\nResultActive=yes\nEOF'\n$ sudo systemctl restart xrdp\n[SUCCESS] RDP Session Established.",
    insight: "**[Ansible 자동화 스크립트 제안 (xrdp-fix.yml)]**\n\`\`\`yaml\n- name: Fix XRDP Black Screen\n  hosts: ubuntu_servers\n  tasks:\n    - name: Configure .xsession\n      lineinfile:\n        path: ~/.xsession\n        line: 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'\n        create: yes\n\`\`\`\n위와 같이 Ansible로 템플릿화하여 대규모 VDI 프로비저닝 시 휴먼 에러를 방지하세요."
  },
  {
    id: "TS-UBUNTU-002",
    category: "Cloud / Network",
    title: "Enterprise Secure FTP (vsftpd) Passive Mode & chroot Refactoring",
    rootCause: "Socket bind conflict (IPv4/IPv6), Active FTP blocked by NAT, and vsftpd chroot strict security policy preventing writable root directories.",
    resolution: "Disabled IPv6, enabled Passive Mode (ports 10000-10100), configured Cloud ACG, whitelisted users, and split chroot directory permissions (550 root, 750 sub-dir).",
    cliMock: "[ERROR] status=2/INVALIDARGUMENT\n[ERROR] 500 OOPS: cannot read config file\n$ sudo mv /etc/vsftpd.conf /etc/vsftpd.conf.bak\n$ sudo sed -i 's/listen_ipv6=YES/#listen_ipv6=YES/g' /etc/vsftpd.conf\n$ echo -e 'pasv_enable=YES\\npasv_min_port=10000\\npasv_max_port=10100' >> /etc/vsftpd.conf\n$ sudo chmod 550 /home/main/ftp && sudo chmod 750 /home/main/ftp/upload\n$ sudo systemctl restart vsftpd\n[SUCCESS] Passive Mode active and chroot security applied.",
    insight: "**[네트워크/보안 아키텍처 개선 제안]**\nFTP는 패킷이 평문으로 전송되므로, 향후 vsftpd 설정에 `ssl_enable=YES`를 추가하여 FTPS로 전환하거나, 포트 22를 활용하는 SFTP 전용 `Subsystem sftp internal-sftp -d /home/main/ftp` 구조로 일원화하는 것을 강력히 권장합니다."
  },
  {
    id: "TS-TOMCAT-003",
    category: "Storage / Middleware",
    title: "Tomcat Log Storage Exhaustion & Automated NAS Lifecycle Pipeline",
    rootCause: "Dual-logging bloated disk. Initial logrotate used gzip -c forcefully compressing all logs. Deleting active logs via 'rm' caused 'Ghost File' inode retention.",
    resolution: "Applied copytruncate to safely rotate catalina.out. Changed postrotate to 'mv' logs to NAS uncompressed. Built daily NAS Cron for +90 days gzip and +180 days deletion.",
    cliMock: "[ERROR] Error 28: No space left on device\n$ df -h | grep /dev/sda1\n/dev/sda1       50G   50G     0  100% /\n$ cat /dev/null > /usr/local/tomcat/logs/catalina.out\n[INFO] Ghost File cleared. Disk space reclaimed.\n$ find /mnt/nas/tomcat_logs -name '*.log' -mtime +90 -exec gzip {} \\;\n$ find /mnt/nas/tomcat_logs -name '*.gz' -mtime +180 -delete\n[SUCCESS] NAS Lifecycle policies executed successfully.",
    insight: "**[Shell Script 고도화 제안 (nas_lifecycle.sh)]**\n\`\`\`bash\n#!/bin/bash\nNAS_DIR=\"/mnt/nas/tomcat_logs\"\n# 3개월 초과 로그 압축\nfind $NAS_DIR -type f -name '*.log' -mtime +90 -print0 | xargs -0 -I{} gzip -9 {}\n# 6개월 초과 로그 삭제\nfind $NAS_DIR -type f -mtime +180 -delete\n\`\`\`\n해당 스크립트를 Crontab에 등록하여 휴먼 에러 없이 스토리지 100% Full 장애를 영구적으로 예방합니다."
  },
  {
    id: "TS-K8S-004",
    category: "Cloud / Kubernetes",
    title: "Kubespray K8s Deployment: Network Timeouts & x509 PKI Cert Resolution",
    rootCause: "ACG blocked ports (2379, 6443, 10250). Auto-generated API server cert lacked Public IP in SAN list, rejecting external kubeconfig access.",
    resolution: "Opened ACG ports. Deleted invalid cert and regenerated via 'kubeadm init phase certs apiserver --apiserver-cert-extra-sans [Public_IP]'.",
    cliMock: "[ERROR] connection refused to 192.168.10.6:6443\n[ERROR] tls: failed to verify certificate: x509... not 223.130.134.7\n$ sudo rm -f /etc/kubernetes/pki/apiserver.*\n$ sudo kubeadm init phase certs apiserver --apiserver-cert-extra-sans 223.130.134.7\n[INFO] Generating new API server RSA key and x509 cert...\n$ sudo docker restart $(docker ps -q -f name=k8s_kube-apiserver)\n$ kubectl get nodes -o wide\n[SUCCESS] Kubeconfig connected securely via Public IP.",
    insight: "**[Kubernetes 인프라 보안 개선 제안]**\nKubespray 배포 시 `inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml` 파일 내에 `supplementary_addresses_in_ssl_keys: [\"223.130.134.7\"]` 항목을 미리 선언해 두면, 인프라 배포와 동시에 올바른 SAN이 포함된 인증서가 발급되어 위와 같은 재발급 수고를 덜 수 있습니다."
  },
  {
    id: "TS-NCP-005",
    category: "Cloud / IaC",
    title: "NCP Terraform VM Provisioning Failure & Dynamic Data Source Refactoring",
    rootCause: "Using hardcoded, static product codes for OS Image and Specs caused drift. NCP API rejected deprecated image codes during 'terraform apply'.",
    resolution: "Refactored to dynamic 'data' sources using regex to fetch the latest Ubuntu 24.04 image and compatible hardware specs at runtime. Secured VPC NIC mapping.",
    cliMock: "[ERROR] ncloud_server: Bad Request: InvalidServerImageProductCode\n$ vi server.tf\n[INFO] Changing hardcoded 'SVR0000000X' to dynamic data.ncloud_server_image.ubuntu24.id\n$ terraform plan\n[INFO] Plan: 2 to add, 0 to change, 0 to destroy.\n$ terraform apply -auto-approve\n[SUCCESS] VM Provisioned completely with idempotent infrastructure code.",
    insight: "**[Terraform 리팩토링 코드 팁 (server.tf)]**\n\`\`\`hcl\ndata \"ncloud_server_image\" \"ubuntu\" {\n  filter {\n    name   = \"product_name\"\n    values = [\"ubuntu-24.04\"]\n    regex  = true\n  }\n}\n\`\`\`\n클라우드 벤더의 API는 버전에 따라 코드가 수시로 변하므로, 항상 `data` 블록을 이용해 실행 시점(Runtime)에 가장 최신/호환되는 스펙 코드를 동적으로 쿼리하는 것이 IaC의 핵심입니다."
  },
  {
    id: "TS-DB-006",
    category: "Database / HA",
    title: "MariaDB MHA Replication: Binlog Failure & System Table Init Fix",
    rootCause: "Legacy my.cnf params caused startup halts. Manual binary install bypassed system table creation, leaving 'mysql' DB empty and binlog engine failed.",
    resolution: "Removed deprecated thread_concurrency. Executed mysql_install_db manually to generate core dictionary. Enabled log-bin and exported master snapshot.",
    cliMock: "[ERROR] Error: Binlogging on server not active\n[Warning] 'THREAD_CONCURRENCY' is deprecated\n$ sudo sed -i '/thread_concurrency/s/^/#/' /etc/mysql/my.cnf\n$ sudo /usr/local/mysql/scripts/mysql_install_db --user=mysql --basedir=/usr/local/mysql\n[INFO] Installing MariaDB/MySQL system tables in '/usr/local/mysql/data' ... OK\n$ sudo systemctl restart mariadb\n$ mysqldump -u root -p --all-databases --master-data > all.sql\n[SUCCESS] Binlog active. Master data dump exported.",
    insight: "**[데이터베이스 아키텍처 조언]**\n바이너리 수동 설치 시 `mysql_install_db`가 누락되면 권한, 플러그인, 복제 관리 테이블이 아예 생성되지 않아 치명적입니다. 배포 스크립트 작성 시 해당 커맨드가 멱등성(한 번만 실행됨)을 가지도록 `if [ ! -d /usr/local/mysql/data/mysql ]; then ...` 과 같은 방어 로직을 추가하세요."
  },
  {
    id: "TS-DB-007",
    category: "Database / HA",
    title: "MariaDB MHA Cluster: Replication Error 1593 & Source Build",
    rootCause: "Slave daemon defaulted to server-id=1 causing an infinite loop block. Standard apt lacked full MHA dependencies for automated failover.",
    resolution: "Corrected server-ids (Master=1, Slave1=2, Slave2=3). Compiled MHA Manager from source. Established bidirectional passwordless SSH trust.",
    cliMock: "[ERROR] Last_IO_Errno: 1593\n[ERROR] Fatal error: master and slave have equal MySQL server ids\n$ ssh root@db-slave-01\n$ sed -i 's/server-id=1/server-id=2/' /etc/mysql/my.cnf\n$ systemctl restart mariadb\n$ mysql -e \"STOP SLAVE; START SLAVE; SHOW SLAVE STATUS\\G\" | grep Running\n[INFO] Slave_IO_Running: Yes\n[INFO] Slave_SQL_Running: Yes\n[SUCCESS] Server ID collision resolved. Replication synced.",
    insight: "**[Ansible을 활용한 MHA 자동화 스크립트 (auto-failover.yml)]**\n\`\`\`yaml\n- name: Deploy MHA Node Dependencies\n  apt:\n    name: ['libdbd-mysql-perl', 'libconfig-tiny-perl', 'liblog-dispatch-perl', 'libparallel-forkmanager-perl']\n    state: present\n\`\`\`\n위와 같이 필수 의존성 패키지를 미리 정의하여 신속하게 Failover 클러스터를 확장할 수 있습니다. 수동 설치의 리스크를 줄이세요."
  },
  {
    id: "TS-DB-008",
    category: "Database / Disaster Recovery",
    title: "MariaDB System DB Corruption Recovery & SSH PAM Bypass for MHA",
    rootCause: "Crash corrupted 'mysql' tablespace. SSH 'UsePAM yes' configuration enforced keyboard-interactive login, overriding RSA Key authentication for MHA.",
    resolution: "Wiped and rebuilt system DB. Used mysqld_safe --skip-grant-tables to restore admin users. Disabled UsePAM in sshd_config to allow MHA passwordless access.",
    cliMock: "[ERROR] OS error: 71, cannot find file /db/data/mysql\n[ERROR] Access Denied for user 'root'\n$ mysqld_safe --skip-grant-tables &\n[INFO] MariaDB started securely bypassing grant tables.\n$ mysql -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpwd';\"\n$ sed -i 's/^UsePAM yes/UsePAM no/' /etc/ssh/sshd_config\n$ systemctl restart sshd\n[SUCCESS] MHA Manager Passwordless SSH authentication successful.",
    insight: "**[L3 엔지니어의 보안 아키텍처 제안]**\n`UsePAM yes`는 리눅스의 플러그인 인증 모듈을 강제하여 MHA의 `authorized_keys` 인증을 무력화시킵니다. 시스템 복구 시 `mysqld_safe`는 강력한 백도어이므로, 복구 후에는 반드시 프로세스를 죽이고(`kill -9`) 정상 데몬으로 재기동하여 보안 공백을 차단해야 합니다."
  },
  {
    id: "TS-IDE-009",
    category: "DevOps / Tooling",
    title: "VS Code Remote-SSH Connection Failure & Client/Server Cache",
    rootCause: "Windows OpenSSH rejected the .pem key due to over-permissive ACLs. Remote VS Code server daemon was locked/corrupted from a terminated session.",
    resolution: "Disabled Windows ACL inheritance on the key (granting only user control). Executed 'rm -rf ~/.vscode-server' on the remote VM via secondary client to purge cache.",
    cliMock: "[ERROR] Permission denied (publickey).\n[ERROR] Bad owner or permissions on C:\\Users\\...\\.ssh\\config\n# Windows PowerShell (Client)\n> icacls mykey.pem /inheritance:r\n> icacls mykey.pem /grant:r \"%USERNAME%:R\" /remove \"Authenticated Users\" /remove \"BUILTIN\\Administrators\"\n# Ubuntu Remote (Server)\n$ rm -rf ~/.vscode-server\n[SUCCESS] Corrupted daemon cache cleared. Remote-SSH connection established.",
    insight: "**[VS Code 원격 개발 환경 최적화 팁]**\n윈도우에서 리눅스로 접근할 때 `.pem` 키의 권한(ACL)이 열려있으면 OpenSSH가 이를 위험 요소로 간주해 무조건 연결을 차단합니다. 리눅스의 `chmod 400`과 동일하게 윈도우 파일 속성에서 '상속 해제' 후 본인 계정만 남기면 문제가 깔끔하게 해결됩니다."
  },
  {
    id: "TS-WEB-010",
    category: "Middleware / Web-WAS",
    title: "Apache2 & Tomcat 9 Integration Failure: AJP Security Mismatch",
    rootCause: "Tomcat 9.0.31+ disabled AJP by default and forced secretRequired=\"true\" binding to 127.0.0.1 (Ghostcat patch). mod_jk requests were rejected.",
    resolution: "Enabled AJP Connector in server.xml with address=\"0.0.0.0\" and secretRequired=\"false\" (or mapped secrets). Configured JkMount correctly in Apache.",
    cliMock: "[ERROR] 503 Service Unavailable\n[ERROR] ajp_connect_to_endpoint::jk_ajp_common.c (1064): failed to connect to Tomcat AJP\n$ vi /usr/local/tomcat/conf/server.xml\n[INFO] Uncommented AJP Connector and added address=\"0.0.0.0\" secretRequired=\"false\"\n$ vi /etc/apache2/workers.properties\n$ systemctl restart tomcat9 apache2\n[SUCCESS] HTTP 200 OK. Apache successfully reverse-proxied to Tomcat via AJP.",
    insight: "**[Ghostcat(CVE-2020-1938) 보안 대응 가이드]**\n단순 연동을 위해 `secretRequired=\"false\"`를 적용하는 것은 편하지만, 실무 환경에서는 `secretRequired=\"true\"`를 유지하고 `server.xml`과 `workers.properties` 양쪽에 `secret=\"MyStrongKey\"`를 부여하여 내부 AJP 통신의 스니핑을 방어하는 것이 보안 스탠다드입니다."
  }
];

// --- 텍스트 파싱 유틸리티 ---
const parseMessageBlocks = (text) => {
  // 마크다운 코드 블록 파싱 정규식
  const regex = /\`\`\`(bash|sh|shell|yaml|yml|hcl)?\n([\s\S]*?)\`\`\`/g;
  const blocks = [];
  let lastIdx = 0;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      blocks.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    }
    blocks.push({ type: 'cli', content: match[2] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    blocks.push({ type: 'text', content: text.substring(lastIdx) });
  }
  return blocks;
};

// --- 컴포넌트: 일반 텍스트 스트리밍 ---
const TextStream = ({ text, animate, onDone }) => {
  const [displayed, setDisplayed] = useState(animate ? '' : text);
  
  useEffect(() => {
    if (!animate) return;
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i += 3; // 글자 출력 속도
      if (i > text.length + 3) {
        setDisplayed(text);
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 10);
    return () => clearInterval(timer);
  }, [animate, text]);

  const formattedText = displayed
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-indigo-900/50 text-indigo-200 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  
  return (
    <div 
      className="mb-3 leading-relaxed whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: formattedText }} 
    />
  );
};

// --- 컴포넌트: CLI 터미널 스트리밍 ---
const CLIStream = ({ code, animate, onDone }) => {
  const lines = code.trim().split('\n');
  const [visibleLines, setVisibleLines] = useState(animate ? [] : lines);
  
  useEffect(() => {
    if (!animate) return;
    let i = 0;
    const timer = setInterval(() => {
      setVisibleLines(lines.slice(0, i + 1));
      i++;
      if (i >= lines.length) {
        clearInterval(timer);
        setTimeout(() => { if (onDone) onDone() }, 500); 
      }
    }, 400); 
    return () => clearInterval(timer);
  }, [animate, code]);

  const renderLine = (l) => {
    if (l.startsWith('[ERROR]')) return <span className="text-red-400 font-bold">{l}</span>;
    if (l.startsWith('[INFO]')) return <span className="text-blue-400">{l}</span>;
    if (l.startsWith('[SUCCESS]')) return <span className="text-emerald-400 font-bold">{l}</span>;
    if (l.startsWith('$')) return <><span className="text-indigo-500 mr-2 select-none">$</span><span className="text-green-300">{l.substring(1)}</span></>;
    if (l.startsWith('>')) return <><span className="text-indigo-500 mr-2 select-none">{'>'}</span><span className="text-green-300">{l.substring(1)}</span></>;
    if (l.startsWith('- name:')) return <span className="text-purple-300">{l}</span>;
    return <span className="text-slate-300">{l}</span>;
  };

  return (
    <div className="bg-[#0c0c0c] text-slate-300 p-4 rounded-xl font-mono text-sm shadow-2xl border border-slate-700/80 my-4 overflow-hidden relative group">
      <div className="flex gap-2 mb-3 border-b border-slate-800 pb-3 items-center">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-slate-500 text-xs ml-2 font-sans tracking-wider">root@l3-master-node:~</span>
      </div>
      <div className="space-y-1.5 break-all">
        {visibleLines.map((l, i) => (
          <div key={i} className="flex whitespace-pre-wrap">{renderLine(l)}</div>
        ))}
        {animate && visibleLines.length < lines.length && (
          <div className="flex">
            <span className="text-indigo-500 mr-3 select-none">$</span>
            <span className="w-2.5 h-4 bg-slate-400 animate-pulse"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: '안녕하세요. L3 클라우드 인프라 트러블슈팅 AI 에이전트입니다. 사내 KB가 성공적으로 로드되었습니다. 어떤 인프라 장애 상황이나 트러블슈팅 조치에 대해 논의해 볼까요?',
      isNew: false 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [activeCLIAction, setActiveCLIAction] = useState(null); 
  const [tokens, setTokens] = useState({ input: 0, output: 0, total: 0, latest: '없음' });
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const messagesEndRef = useRef(null);
  
  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchGemini = async (payload) => {
    const apiKey = "";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
          if (response.status === 429) { await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt))); continue; }
          throw new Error(`API Error: ${response.status}`);
        }
        return await response.json();
      } catch (err) { if (attempt === 4) throw err; }
    }
  };

  const retrieveContext = (query) => {
    const q = query.toLowerCase();
    const matches = troubleshootingData.filter(item => 
      item.title.toLowerCase().includes(q) || item.rootCause.toLowerCase().includes(q) || item.resolution.toLowerCase().includes(q)
    );
    // 해당하는 내용이 없으면 전체 리스트 제공
    if (matches.length === 0) return troubleshootingData.map(d => `[${d.id}] ${d.title}`).join('\n');
    return matches.map(m => `ID: ${m.id}\nTitle: ${m.title}\nRoot Cause: ${m.rootCause}\nResolution: ${m.resolution}\nCLI Mock: ${m.cliMock}\nInsight: ${m.insight}`).join('\n\n');
  };

  // --- 비용 절감형 (캐싱) 프리셋 버튼 클릭 핸들러 ---
  // API 호출 없이 무조건 내부 KB 데이터로만 화면을 구성합니다. (비용 완벽 차단)
  const handlePresetClick = (item) => {
    const userText = `${item.title} 장애에 대한 원인과 해결 방법을 알려줘.`;
    setMessages(prev => [...prev, { role: 'user', content: userText, isNew: false }]);
    
    // 내부 DB 데이터로만 기존 응답과 똑같은 포맷 생성
    const cachedReply = `해당 장애 내용에 대한 분석 및 조치 가이드입니다.\n\n**[Root Cause Analysis]**\n${item.rootCause}\n\n**[Resolution]**\n${item.resolution}\n\n\`\`\`bash\n${item.cliMock}\n\`\`\`\n\n${item.insight}`;
    
    // FinOps 어필을 위해 토큰을 0으로 갱신
    setTokens(prev => ({ ...prev, latest: '0 토큰 (Cache Hit - 비용 0원)' }));

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: cachedReply, isNew: true }]);
    }, 400);
  };

  // --- 실제 입력창에 타이핑했을 때만 API를 호출하는 핸들러 ---
  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText, isNew: false }]);
    setIsLoading(true);

    const context = retrieveContext(userText);
    
    // AI 프롬프트 강화: 내부 KB가 없어도 실무 베스트 프랙티스로 답변하도록 유도
    const systemInstruction = `당신은 실력이 매우 뛰어난 L3 클라우드 서포트 엔지니어(AI 에이전트)입니다.
[지침]:
1. 사용자의 질문이 아래 [Knowledge Base]에 해당한다면 최우선으로 이를 바탕으로 답변하세요.
2. 만약 [Knowledge Base]에 없는 내용이더라도, IT 인프라, 클라우드, AI, 트러블슈팅, 개발 환경 등과 관련된 질문이라면 당신의 풍부한 실무 지식(Best Practice)을 바탕으로 전문적이고 상세하게 답변해 주세요. 
3. 명령어나 스크립트가 필요하다면 반드시 \`\`\`bash 형식(또는 해당 언어)의 마크다운 코드 블록으로 작성하세요. 
4. 답변 후 마지막에는 '**💡 L3 엔지니어의 추가 인사이트:**'를 통해 아키텍처 개선, 자동화(Ansible, Terraform), 보안 등의 전문적인 제안을 추가하세요.

[Knowledge Base]:
${context}`;

    const contents = messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: userText }] });

    try {
      const result = await fetchGemini({ contents, systemInstruction: { parts: [{ text: systemInstruction }] } });
      const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성하지 못했습니다.";
      
      if (result.usageMetadata) {
        setTokens(prev => ({
          input: prev.input + result.usageMetadata.promptTokenCount,
          output: prev.output + result.usageMetadata.candidatesTokenCount,
          total: prev.total + result.usageMetadata.totalTokenCount,
          latest: `${result.usageMetadata.totalTokenCount} 토큰 (API 호출)`
        }));
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply, isNew: true }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류가 발생했습니다: ${error.message}`, isNew: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSelectedSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    
    const targetCase = troubleshootingData.find(c => c.id === "TS-DB-007");
    
    const incidents = [
      { id: `INC-${Date.now()}-1`, msg: `🚨 [장애 감지] ${targetCase.title}`, icon: <AlertCircle className="w-5 h-5 text-red-500" />, color: "border-red-500/50 bg-red-500/10" },
      { id: `INC-${Date.now()}-2`, msg: `💬 [사내 메신저] #incident-response 채널 상황 전파`, icon: <MessageSquare className="w-5 h-5 text-blue-400" />, color: "border-blue-500/50 bg-blue-500/10" },
      { id: `INC-${Date.now()}-3`, msg: `📧 [고객사 알림] 장애 대응 및 원인 분석 시작`, icon: <Mail className="w-5 h-5 text-emerald-400" />, color: "border-emerald-500/50 bg-emerald-500/10" }
    ];

    setToasts(incidents);
    setActiveIncidents(incidents);

    setTimeout(() => {
      setToasts([]); 
      
      const rcaMsg = `🚨 **[긴급 장애 감지 및 RCA 분석 완료]**\n${targetCase.title} 장애가 발생했습니다.\n\n**[Root Cause Analysis]**\n• ${targetCase.rootCause}\n\nCLI트러블슈팅 실행 버튼을 클릭하여 복구를 진행하세요.`;

      setMessages(prev => [...prev, { 
        role: 'system', 
        content: rcaMsg, 
        isNew: true
      }]);
      
      setActiveCLIAction(targetCase.id); 
    }, 5000);
  };

  const handleCLIAction = (actionId) => {
    setActiveCLIAction(null); 
    const targetCase = troubleshootingData.find(c => c.id === actionId);
    
    const cliContent = `복구 파이프라인 및 터미널 엑세스를 통해 조치를 시작합니다.\n\n\`\`\`bash\n${targetCase.cliMock}\n\`\`\`\n\n${targetCase.insight}`;

    setMessages(prev => [...prev, { role: 'assistant', content: cliContent, isNew: true }]);
    setActiveIncidents([]); 
    setIsSimulating(false);
  };

  const SequenceRenderer = ({ blocks, isNew }) => {
    const [currentIndex, setCurrentIndex] = useState(isNew ? 0 : blocks.length);
    return (
      <div className="space-y-2">
        {blocks.map((block, idx) => {
          if (idx > currentIndex) return null;
          if (block.type === 'text') {
            return <TextStream key={idx} text={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} />;
          }
          if (block.type === 'cli') {
            return <CLIStream key={idx} code={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} />;
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-slate-200 font-sans overflow-hidden md:flex-row flex-col relative">
      
      {/* Toast Notifications */}
      <div className="absolute top-4 right-4 z-50 space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all animate-in slide-in-from-right-8 ${toast.color}`}>
            {toast.icon}
            <span className="text-sm font-medium text-slate-200">{toast.msg}</span>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 z-10 relative">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-[17px] leading-tight">L3 Troubleshooting Agent</h1>
              <span className="text-[11px] text-indigo-400 font-mono tracking-widest">AI SYSTEM</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/30">
          <button 
            onClick={triggerSelectedSimulation}
            disabled={isSimulating}
            className="w-full bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 border border-red-500/30 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all group"
          >
            <BellRing className={`w-4 h-4 ${!isSimulating && 'group-hover:animate-wiggle'}`} /> 🚨 긴급 장애 발생 시뮬레이션
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> FinOps Token Monitor
          </h2>
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-inner mb-6">
            <div className="text-center mb-4 pb-4 border-b border-slate-800/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Total Usage</span>
              <span className="text-3xl font-light text-white">{tokens.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-500">Input</span>
              <span className="text-indigo-300">{tokens.input.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mb-4 pb-4 border-b border-slate-800/50">
              <span className="text-slate-500">Output</span>
              <span className="text-teal-300">{tokens.output.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 text-center font-bold text-green-400">Last: {tokens.latest}</div>
          </div>

          {activeCLIAction && (
            <div className="mt-auto pt-4 animate-in slide-in-from-bottom-5">
              <h2 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2 text-center">Action Required</h2>
              <button
                onClick={() => handleCLIAction(activeCLIAction)}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all border border-green-400 animate-pulse"
              >
                <PlayCircle className="w-5 h-5" /> CLI 트러블슈팅 실행
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main UI Area */}
      <main className="flex-1 flex flex-col h-full relative">
        <header className="h-14 bg-slate-900/50 backdrop-blur border-b border-slate-800 flex justify-end items-center px-6 z-20 shrink-0">
           <div className="relative cursor-pointer" onClick={() => setIsNotifOpen(!isNotifOpen)}>
             <BellRing className={`w-5 h-5 transition-colors ${isNotifOpen ? 'text-white' : 'text-slate-400 hover:text-white'}`} />
             {activeIncidents.length > 0 && (
               <span className="absolute -top-1 -right-1 flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-slate-900"></span>
               </span>
             )}
             
             <div className={`absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl transition-all duration-200 p-2 ${isNotifOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                <h3 className="text-xs font-bold text-slate-400 mb-2 px-2 pt-1 uppercase">진행 중인 장애 내역</h3>
                {activeIncidents.length === 0 ? (
                  <div className="p-3 text-sm text-slate-500 text-center">현재 진행 중인 장애가 없습니다.</div>
                ) : activeIncidents.map(inc => (
                  <div key={inc.id} className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg mb-2 last:mb-0">
                    <p className="text-xs text-slate-300 flex items-center gap-2 leading-relaxed">
                      {inc.icon} {inc.msg}
                    </p>
                  </div>
                ))}
             </div>
           </div>
        </header>

        {/* 채팅 내역 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';
              const blocks = parseMessageBlocks(msg.content);

              return (
                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`
                    max-w-[95%] md:max-w-[85%] rounded-2xl p-5 shadow-sm
                    ${isUser 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : isSystem 
                        ? 'bg-slate-900 border-2 border-red-500/30 text-slate-200 rounded-tl-none shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none shadow-lg'
                    }
                  `}>
                    <div className="flex items-center gap-2 mb-3 opacity-60 border-b border-white/10 pb-2">
                      {isUser ? <Smartphone className="w-4 h-4" /> : isSystem ? <ShieldAlert className="w-4 h-4 text-red-400" /> : <Activity className="w-4 h-4 text-indigo-400" />}
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isUser ? 'You' : isSystem ? 'System Analysis' : 'L3 Agent'}
                      </span>
                    </div>
                    
                    <div className="text-sm md:text-base break-words">
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <SequenceRenderer blocks={blocks} isNew={msg.isNew} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-none p-5 flex items-center gap-4 shadow-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <span className="text-sm font-medium animate-pulse">원인(RCA) 분석 및 조치 방안 생성 중...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* --- 항시 고정된 하단 영역 (버튼 메뉴 + 입력창) --- */}
        <div className="bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 flex flex-col pb-safe shrink-0">
          
          {/* 이슈 문의 사항 예시 (항상 노출되며 문구 수정됨) */}
          <div className="max-w-4xl mx-auto w-full px-4 pt-4">
            <div className="text-xs text-slate-500 font-bold mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> 이슈 문의 사항 예시
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {troubleshootingData.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => handlePresetClick(item)} 
                  disabled={isLoading}
                  className="text-[11px] whitespace-nowrap shrink-0 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 border border-slate-700 px-3.5 py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {/* 질문 직접 입력창 (API 호출용) */}
          <div className="max-w-4xl mx-auto w-full p-4 pt-2">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="장애 증상이나 기술 질문을 자유롭게 입력하세요 (이 경우만 AI 호출)..."
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
          </div>

        </div>

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
        @media (max-width: 768px) { .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); } }
      `}} />
    </div>
  );
}