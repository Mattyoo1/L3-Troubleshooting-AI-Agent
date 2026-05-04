import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Terminal, BellRing, Cpu, PlayCircle, AlertCircle, 
  MessageSquare, Mail, Smartphone, ShieldAlert, Activity, 
  HelpCircle, Loader2, Send, BarChart3, Globe, Sun, Moon,
  Menu, X, CheckCircle, Zap
} from 'lucide-react';

// --- 사내 지식 베이스 (Troubleshooting Data) ---
const kbData = {
  ko: [
    {
      id: "TS-LINUX-001", category: "OS / GUI",
      title: "Ubuntu 22.04 XRDP 블랙 스크린 및 Polkit 충돌",
      rootCause: "기본 Gnome 세션과 XRDP 간의 충돌 및 너무 엄격한 polkit 규칙으로 인해 콘솔 외부 사용자의 color managed device 생성이 차단됨.",
      resolution: "~/.xsession 파일에 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'을 작성하고, colord를 허용하는 사용자 지정 polkit .pkla 파일을 추가함.",
      cliMock: "[ERROR] xrdp_mm_process_login_response: login failed\n$ echo 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session' > ~/.xsession\n$ sudo bash -c 'cat > /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla <<EOF\n[Allow Colord all Users]\nIdentity=unix-user:*\nAction=org.freedesktop.color-manager.create-device\nResultAny=no\nResultInactive=no\nResultActive=yes\nEOF'\n$ sudo systemctl restart xrdp\n[SUCCESS] RDP Session Established.",
      insight: "**[Ansible 자동화 스크립트 제안 (xrdp-fix.yml)]**\n\u0060\u0060\u0060yaml\n- name: Fix XRDP Black Screen\n  hosts: ubuntu_servers\n  tasks:\n    - name: Configure .xsession\n      lineinfile:\n        path: ~/.xsession\n        line: 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'\n        create: yes\n\u0060\u0060\u0060\n위와 같이 Ansible로 템플릿화하여 대규모 VDI 프로비저닝 시 휴먼 에러를 방지하세요."
    },
    {
      id: "TS-UBUNTU-002", category: "Cloud / Network",
      title: "엔터프라이즈 보안 FTP (vsftpd) Passive Mode & chroot 리팩토링",
      rootCause: "소켓 바인드 충돌(IPv4/IPv6), NAT에 의해 Active FTP가 차단됨, vsftpd chroot의 엄격한 보안 정책으로 인해 쓰기 가능한 루트 디렉토리가 차단됨.",
      resolution: "IPv6 비활성화, Passive Mode(포트 10000-10100) 활성화, 클라우드 ACG 구성, chroot 디렉토리 권한 분리(루트 550, 하위 750).",
      cliMock: "[ERROR] status=2/INVALIDARGUMENT\n[ERROR] 500 OOPS: cannot read config file\n$ sudo mv /etc/vsftpd.conf /etc/vsftpd.conf.bak\n$ sudo sed -i 's/listen_ipv6=YES/#listen_ipv6=YES/g' /etc/vsftpd.conf\n$ echo -e 'pasv_enable=YES\\npasv_min_port=10000\\npasv_max_port=10100' >> /etc/vsftpd.conf\n$ sudo chmod 550 /home/main/ftp && sudo chmod 750 /home/main/ftp/upload\n$ sudo systemctl restart vsftpd\n[SUCCESS] Passive Mode active and chroot security applied.",
      insight: "**[네트워크/보안 아키텍처 개선 제안]**\nFTP는 패킷이 평문으로 전송되므로, 향후 vsftpd 설정에 \u0060ssl_enable=YES\u0060를 추가하여 FTPS로 전환하거나, 포트 22를 활용하는 SFTP 전용 \u0060Subsystem sftp internal-sftp -d /home/main/ftp\u0060 구조로 일원화하는 것을 강력히 권장합니다."
    },
    {
      id: "TS-TOMCAT-003", category: "Storage / Middleware",
      title: "Tomcat 로그 스토리지 고갈 및 NAS 자동화 파이프라인",
      rootCause: "이중 로깅으로 인한 디스크 비대화. 기존 logrotate가 gzip -c를 사용해 로그를 강제 압축함. 'rm'으로 활성 로그 삭제 시 '고스트 파일'이 발생해 inode 반환이 안 됨.",
      resolution: "catalina.out을 안전하게 롤링하도록 copytruncate 적용. uncompressed 상태로 NAS에 'mv'하도록 postrotate 수정. +90일 압축, +180일 삭제 NAS Cron 구축.",
      cliMock: "[ERROR] Error 28: No space left on device\n$ df -h | grep /dev/sda1\n/dev/sda1       50G   50G     0  100% /\n$ cat /dev/null > /usr/local/tomcat/logs/catalina.out\n[INFO] Ghost File cleared. Disk space reclaimed.\n$ find /mnt/nas/tomcat_logs -name '*.log' -mtime +90 -exec gzip {} \\;\n$ find /mnt/nas/tomcat_logs -name '*.gz' -mtime +180 -delete\n[SUCCESS] NAS Lifecycle policies executed successfully.",
      insight: "**[Shell Script 고도화 제안 (nas_lifecycle.sh)]**\n\u0060\u0060\u0060bash\n#!/bin/bash\nNAS_DIR=\"/mnt/nas/tomcat_logs\"\n# 3개월 초과 로그 압축\nfind $NAS_DIR -type f -name '*.log' -mtime +90 -print0 | xargs -0 -I{} gzip -9 {}\n# 6개월 초과 로그 삭제\nfind $NAS_DIR -type f -mtime +180 -delete\n\u0060\u0060\u0060\n해당 스크립트를 Crontab에 등록하여 스토리지 100% Full 장애를 영구적으로 예방하세요."
    },
    {
      id: "TS-K8S-004", category: "Cloud / Kubernetes",
      title: "Kubespray K8s 배포: 네트워크 타임아웃 및 x509 PKI 인증 오류",
      rootCause: "ACG 방화벽 포트(2379, 6443, 10250) 차단됨. 자동 생성된 API 서버 인증서의 SAN 목록에 Public IP가 누락되어 외부 kubeconfig 접근 거부됨.",
      resolution: "ACG 포트 개방. 잘못된 인증서를 삭제하고 '--apiserver-cert-extra-sans' 옵션을 주어 kubeadm으로 재발급.",
      cliMock: "[ERROR] connection refused to 192.168.10.6:6443\n[ERROR] tls: failed to verify certificate: x509... not 223.130.134.7\n$ sudo rm -f /etc/kubernetes/pki/apiserver.*\n$ sudo kubeadm init phase certs apiserver --apiserver-cert-extra-sans 223.130.134.7\n[INFO] Generating new API server RSA key and x509 cert...\n$ sudo docker restart $(docker ps -q -f name=k8s_kube-apiserver)\n$ kubectl get nodes -o wide\n[SUCCESS] Kubeconfig connected securely via Public IP.",
      insight: "**[Kubernetes 인프라 보안 개선 제안]**\nKubespray 배포 시 \u0060inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml\u0060 파일 내에 \u0060supplementary_addresses_in_ssl_keys: [\"Public IP\"]\u0060 항목을 미리 선언해 두면 인증서 재발급 수고를 덜 수 있습니다."
    },
    {
      id: "TS-NCP-005", category: "Cloud / IaC",
      title: "NCP Terraform VM 프로비저닝 실패 및 동적 데이터 소스 리팩토링",
      rootCause: "OS 이미지 및 스펙에 하드코딩된 정적 상품 코드를 사용하여 드리프트 발생. NCP API가 'terraform apply' 중 사용되지 않는 이미지 코드를 거부함.",
      resolution: "정규식을 사용하여 런타임에 가장 최신의 호환 가능한 스펙 코드를 동적으로 가져오는 'data' 소스 방식으로 리팩토링.",
      cliMock: "[ERROR] ncloud_server: Bad Request: InvalidServerImageProductCode\n$ vi server.tf\n[INFO] Changing hardcoded 'SVR0000000X' to dynamic data.ncloud_server_image.ubuntu24.id\n$ terraform plan\n[INFO] Plan: 2 to add, 0 to change, 0 to destroy.\n$ terraform apply -auto-approve\n[SUCCESS] VM Provisioned completely with idempotent infrastructure code.",
      insight: "**[Terraform 리팩토링 코드 팁 (server.tf)]**\n\u0060\u0060\u0060hcl\ndata \"ncloud_server_image\" \"ubuntu\" {\n  filter {\n    name   = \"product_name\"\n    values = [\"ubuntu-24.04\"]\n    regex  = true\n  }\n}\n\u0060\u0060\u0060\n클라우드 벤더의 API 코드는 수시로 변하므로, 항상 \u0060data\u0060 블록을 이용해 런타임에 최신 코드를 쿼리하는 것이 IaC의 핵심입니다."
    },
    {
      id: "TS-DB-006", category: "Database / HA",
      title: "MariaDB MHA 복제: Binlog 실패 및 시스템 테이블 초기화 버그",
      rootCause: "my.cnf의 구형 파라미터로 인해 데몬 시작 실패. 바이너리 수동 설치 시 시스템 테이블 생성을 건너뛰어 'mysql' DB가 비어있고 binlog 엔진이 실패함.",
      resolution: "사용 중단된 thread_concurrency 제거. mysql_install_db를 수동으로 실행하여 핵심 테이블 생성. log-bin 활성화 후 스냅샷 덤프.",
      cliMock: "[ERROR] Error: Binlogging on server not active\n[Warning] 'THREAD_CONCURRENCY' is deprecated\n$ sudo sed -i '/thread_concurrency/s/^/#/' /etc/mysql/my.cnf\n$ sudo /usr/local/mysql/scripts/mysql_install_db --user=mysql --basedir=/usr/local/mysql\n[INFO] Installing MariaDB/MySQL system tables in '/usr/local/mysql/data' ... OK\n$ sudo systemctl restart mariadb\n$ mysqldump -u root -p --all-databases --master-data > all.sql\n[SUCCESS] Binlog active. Master data dump exported.",
      insight: "**[데이터베이스 아키텍처 조언]**\n바이너리 수동 설치 시 \u0060mysql_install_db\u0060가 누락되면 권한, 복제 관리 테이블이 생성되지 않아 치명적입니다. 배포 스크립트에 \u0060if [ ! -d /usr/local/mysql/data/mysql ]; then ...\u0060 방어 로직을 추가하세요."
    },
    {
      id: "TS-DB-007", category: "Database / HA",
      title: "MariaDB MHA 클러스터: 복제 에러 1593 및 소스 빌드",
      rootCause: "Slave 데몬이 기본값인 server-id=1로 켜져 무한 루프 블록 발생. 자동 페일오버를 위한 MHA 의존성 패키지가 누락됨.",
      resolution: "server-id 충돌 수정 (Master=1, Slave1=2, Slave2=3). 소스에서 MHA Manager 컴파일 및 양방향 패스워드 없는 SSH 신뢰 구축.",
      cliMock: "[ERROR] Last_IO_Errno: 1593\n[ERROR] Fatal error: master and slave have equal MySQL server ids\n$ ssh root@db-slave-01\n$ sed -i 's/server-id=1/server-id=2/' /etc/mysql/my.cnf\n$ systemctl restart mariadb\n$ mysql -e \"STOP SLAVE; START SLAVE; SHOW SLAVE STATUS\\G\" | grep Running\n[INFO] Slave_IO_Running: Yes\n[INFO] Slave_SQL_Running: Yes\n[SUCCESS] Server ID collision resolved. Replication synced.",
      insight: "**[Ansible을 활용한 MHA 자동화 스크립트 (auto-failover.yml)]**\n\u0060\u0060\u0060yaml\n- name: Deploy MHA Node Dependencies\n  apt:\n    name: ['libdbd-mysql-perl', 'libconfig-tiny-perl', 'liblog-dispatch-perl', 'libparallel-forkmanager-perl']\n    state: present\n\u0060\u0060\u0060\n필수 의존성 패키지를 미리 정의하여 신속하게 Failover 클러스터를 확장할 수 있습니다."
    },
    {
      id: "TS-DB-008", category: "Database / Disaster Recovery",
      title: "MariaDB 시스템 DB 손상 복구 및 MHA SSH PAM 우회",
      rootCause: "크래시로 인한 'mysql' 테이블스페이스 손상. SSH 'UsePAM yes' 설정이 키보드 대화형 로그인을 강제하여 MHA의 RSA 인증을 덮어씀.",
      resolution: "시스템 DB 삭제 후 재생성. mysqld_safe --skip-grant-tables를 사용하여 관리자 유저 복구. SSH 설정에서 UsePAM을 비활성화.",
      cliMock: "[ERROR] OS error: 71, cannot find file /db/data/mysql\n[ERROR] Access Denied for user 'root'\n$ mysqld_safe --skip-grant-tables &\n[INFO] MariaDB started securely bypassing grant tables.\n$ mysql -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpwd';\"\n$ sed -i 's/^UsePAM yes/UsePAM no/' /etc/ssh/sshd_config\n$ systemctl restart sshd\n[SUCCESS] MHA Manager Passwordless SSH authentication successful.",
      insight: "**[L3 엔지니어의 보안 아키텍처 제안]**\n\u0060UsePAM yes\u0060는 MHA의 \u0060authorized_keys\u0060 인증을 무력화시킵니다. 시스템 복구 시 사용한 \u0060mysqld_safe\u0060는 백도어이므로, 복구 후 프로세스를 죽이고(\u0060kill -9\u0060) 정상 데몬으로 재기동하여 보안 공백을 차단해야 합니다."
    },
    {
      id: "TS-IDE-009", category: "DevOps / Tooling",
      title: "VS Code Remote-SSH 접속 실패 및 캐시 손상",
      rootCause: "Windows OpenSSH가 과도한 ACL 권한으로 인해 .pem 키를 거부함. 비정상 종료된 세션으로 인해 원격 VS Code 서버 데몬이 손상됨.",
      resolution: "키의 Windows ACL 상속을 비활성화(사용자 권한만 부여). 서브 클라이언트를 통해 원격 VM에서 'rm -rf ~/.vscode-server'를 실행하여 캐시 퍼지.",
      cliMock: "[ERROR] Permission denied (publickey).\n[ERROR] Bad owner or permissions on C:\\Users\\...\\.ssh\\config\n# Windows PowerShell (Client)\n> icacls mykey.pem /inheritance:r\n> icacls mykey.pem /grant:r \"%USERNAME%:R\" /remove \"Authenticated Users\" /remove \"BUILTIN\\Administrators\"\n# Ubuntu Remote (Server)\n$ rm -rf ~/.vscode-server\n[SUCCESS] Corrupted daemon cache cleared. Remote-SSH connection established.",
      insight: "**[VS Code 원격 개발 환경 최적화 팁]**\n윈도우에서 리눅스로 접근할 때 \u0060.pem\u0060 키의 권한(ACL)이 열려있으면 연결을 차단합니다. 리눅스의 \u0060chmod 400\u0060과 동일하게 파일 속성에서 '상속 해제' 후 본인 계정만 남기면 깔끔하게 해결됩니다."
    },
    {
      id: "TS-WEB-010", category: "Middleware / Web-WAS",
      title: "Apache2 & Tomcat 9 연동 실패: AJP 보안 미스매치",
      rootCause: "Tomcat 9.0.31 이상의 Ghostcat 패치로 인해 AJP가 기본 비활성화되고 secretRequired=\"true\"가 강제되어 mod_jk 요청이 거부됨.",
      resolution: "server.xml에서 AJP Connector를 활성화하고 address=\"0.0.0.0\" 및 secretRequired=\"false\"로 변경. Apache JkMount 설정 재확인.",
      cliMock: "[ERROR] 503 Service Unavailable\n[ERROR] ajp_connect_to_endpoint::jk_ajp_common.c (1064): failed to connect to Tomcat AJP\n$ vi /usr/local/tomcat/conf/server.xml\n[INFO] Uncommented AJP Connector and added address=\"0.0.0.0\" secretRequired=\"false\"\n$ vi /etc/apache2/workers.properties\n$ systemctl restart tomcat9 apache2\n[SUCCESS] HTTP 200 OK. Apache successfully reverse-proxied to Tomcat via AJP.",
      insight: "**[Ghostcat(CVE-2020-1938) 보안 대응 가이드]**\n단순 연동을 위해 \u0060secretRequired=\"false\"\u0060를 적용하는 것은 편하지만, 실무에서는 \u0060secretRequired=\"true\"\u0060를 유지하고 \u0060server.xml\u0060과 \u0060workers.properties\u0060 양쪽에 시크릿 키를 부여하여 내부 AJP 통신의 스니핑을 방어하는 것이 스탠다드입니다."
    }
  ],
  en: [
    {
      id: "TS-LINUX-001", category: "OS / GUI",
      title: "Ubuntu 22.04 XRDP Black Screen & Polkit Crash",
      rootCause: "Default Gnome session conflict with XRDP and overly strict polkit rules blocking non-console users from creating color managed devices.",
      resolution: "Created ~/.xsession with 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'. Added custom polkit .pkla file to allow colord.",
      cliMock: "[ERROR] xrdp_mm_process_login_response: login failed\n$ echo 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session' > ~/.xsession\n$ sudo bash -c 'cat > /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla <<EOF\n[Allow Colord all Users]\nIdentity=unix-user:*\nAction=org.freedesktop.color-manager.create-device\nResultAny=no\nResultInactive=no\nResultActive=yes\nEOF'\n$ sudo systemctl restart xrdp\n[SUCCESS] RDP Session Established.",
      insight: "**[Ansible Automation Script Proposal (xrdp-fix.yml)]**\n\u0060\u0060\u0060yaml\n- name: Fix XRDP Black Screen\n  hosts: ubuntu_servers\n  tasks:\n    - name: Configure .xsession\n      lineinfile:\n        path: ~/.xsession\n        line: 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'\n        create: yes\n\u0060\u0060\u0060\nUse Ansible to template this configuration and prevent human errors during large-scale VDI provisioning."
    },
    {
      id: "TS-UBUNTU-002", category: "Cloud / Network",
      title: "Enterprise Secure FTP (vsftpd) Passive Mode & chroot Refactoring",
      rootCause: "Socket bind conflict (IPv4/IPv6), Active FTP blocked by NAT, and vsftpd chroot strict security policy preventing writable root directories.",
      resolution: "Disabled IPv6, enabled Passive Mode (ports 10000-10100), configured Cloud ACG, whitelisted users, and split chroot directory permissions (550 root, 750 sub-dir).",
      cliMock: "[ERROR] status=2/INVALIDARGUMENT\n[ERROR] 500 OOPS: cannot read config file\n$ sudo mv /etc/vsftpd.conf /etc/vsftpd.conf.bak\n$ sudo sed -i 's/listen_ipv6=YES/#listen_ipv6=YES/g' /etc/vsftpd.conf\n$ echo -e 'pasv_enable=YES\\npasv_min_port=10000\\npasv_max_port=10100' >> /etc/vsftpd.conf\n$ sudo chmod 550 /home/main/ftp && sudo chmod 750 /home/main/ftp/upload\n$ sudo systemctl restart vsftpd\n[SUCCESS] Passive Mode active and chroot security applied.",
      insight: "**[Network/Security Architecture Improvement]**\nSince FTP transmits packets in plaintext, it is highly recommended to add \u0060ssl_enable=YES\u0060 to vsftpd config for FTPS, or unify the architecture using port 22 with \u0060Subsystem sftp internal-sftp -d /home/main/ftp\u0060."
    },
    {
      id: "TS-TOMCAT-003", category: "Storage / Middleware",
      title: "Tomcat Log Storage Exhaustion & Automated NAS Lifecycle Pipeline",
      rootCause: "Dual-logging bloated disk. Initial logrotate used gzip -c forcefully compressing all logs. Deleting active logs via 'rm' caused 'Ghost File' inode retention.",
      resolution: "Applied copytruncate to safely rotate catalina.out. Changed postrotate to 'mv' logs to NAS uncompressed. Built daily NAS Cron for +90 days gzip and +180 days deletion.",
      cliMock: "[ERROR] Error 28: No space left on device\n$ df -h | grep /dev/sda1\n/dev/sda1       50G   50G     0  100% /\n$ cat /dev/null > /usr/local/tomcat/logs/catalina.out\n[INFO] Ghost File cleared. Disk space reclaimed.\n$ find /mnt/nas/tomcat_logs -name '*.log' -mtime +90 -exec gzip {} \\;\n$ find /mnt/nas/tomcat_logs -name '*.gz' -mtime +180 -delete\n[SUCCESS] NAS Lifecycle policies executed successfully.",
      insight: "**[Shell Script Automation (nas_lifecycle.sh)]**\n\u0060\u0060\u0060bash\n#!/bin/bash\nNAS_DIR=\"/mnt/nas/tomcat_logs\"\n# Compress logs older than 90 days\nfind $NAS_DIR -type f -name '*.log' -mtime +90 -print0 | xargs -0 -I{} gzip -9 {}\n# Delete logs older than 180 days\nfind $NAS_DIR -type f -mtime +180 -delete\n\u0060\u0060\u0060\nRegister this script in Crontab to permanently prevent 100% storage full incidents."
    },
    {
      id: "TS-K8S-004", category: "Cloud / Kubernetes",
      title: "Kubespray K8s Deployment: Network Timeouts & x509 PKI Cert Resolution",
      rootCause: "ACG blocked ports (2379, 6443, 10250). Auto-generated API server cert lacked Public IP in SAN list, rejecting external kubeconfig access.",
      resolution: "Opened ACG ports. Deleted invalid cert and regenerated via 'kubeadm init phase certs apiserver --apiserver-cert-extra-sans [Public_IP]'.",
      cliMock: "[ERROR] connection refused to 192.168.10.6:6443\n[ERROR] tls: failed to verify certificate: x509... not 223.130.134.7\n$ sudo rm -f /etc/kubernetes/pki/apiserver.*\n$ sudo kubeadm init phase certs apiserver --apiserver-cert-extra-sans 223.130.134.7\n[INFO] Generating new API server RSA key and x509 cert...\n$ sudo docker restart $(docker ps -q -f name=k8s_kube-apiserver)\n$ kubectl get nodes -o wide\n[SUCCESS] Kubeconfig connected securely via Public IP.",
      insight: "**[Kubernetes Infrastructure Security Tip]**\nDuring Kubespray deployment, if you pre-declare \u0060supplementary_addresses_in_ssl_keys: [\"Public IP\"]\u0060 in \u0060inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml\u0060, the certificate will be issued with the correct SAN automatically."
    },
    {
      id: "TS-NCP-005", category: "Cloud / IaC",
      title: "NCP Terraform VM Provisioning Failure & Dynamic Data Source Refactoring",
      rootCause: "Using hardcoded, static product codes for OS Image and Specs caused drift. NCP API rejected deprecated image codes during 'terraform apply'.",
      resolution: "Refactored to dynamic 'data' sources using regex to fetch the latest Ubuntu 24.04 image and compatible hardware specs at runtime. Secured VPC NIC mapping.",
      cliMock: "[ERROR] ncloud_server: Bad Request: InvalidServerImageProductCode\n$ vi server.tf\n[INFO] Changing hardcoded 'SVR0000000X' to dynamic data.ncloud_server_image.ubuntu24.id\n$ terraform plan\n[INFO] Plan: 2 to add, 0 to change, 0 to destroy.\n$ terraform apply -auto-approve\n[SUCCESS] VM Provisioned completely with idempotent infrastructure code.",
      insight: "**[Terraform Refactoring Tip (server.tf)]**\n\u0060\u0060\u0060hcl\ndata \"ncloud_server_image\" \"ubuntu\" {\n  filter {\n    name   = \"product_name\"\n    values = [\"ubuntu-24.04\"]\n    regex  = true\n  }\n}\n\u0060\u0060\u0060\nCloud vendor API codes change frequently. Always use the \u0060data\u0060 block to dynamically query the latest compatible spec at runtime; this is the core of IaC."
    },
    {
      id: "TS-DB-006", category: "Database / HA",
      title: "MariaDB MHA Replication: Binlog Failure & System Table Init Fix",
      rootCause: "Legacy my.cnf params caused startup halts. Manual binary install bypassed system table creation, leaving 'mysql' DB empty and binlog engine failed.",
      resolution: "Removed deprecated thread_concurrency. Executed mysql_install_db manually to generate core dictionary. Enabled log-bin and exported master snapshot.",
      cliMock: "[ERROR] Error: Binlogging on server not active\n[Warning] 'THREAD_CONCURRENCY' is deprecated\n$ sudo sed -i '/thread_concurrency/s/^/#/' /etc/mysql/my.cnf\n$ sudo /usr/local/mysql/scripts/mysql_install_db --user=mysql --basedir=/usr/local/mysql\n[INFO] Installing MariaDB/MySQL system tables in '/usr/local/mysql/data' ... OK\n$ sudo systemctl restart mariadb\n$ mysqldump -u root -p --all-databases --master-data > all.sql\n[SUCCESS] Binlog active. Master data dump exported.",
      insight: "**[Database Architecture Advice]**\nIf \u0060mysql_install_db\u0060 is omitted during manual installation, crucial permission and replication tables won't be created. Add defensive logic like \u0060if [ ! -d /usr/local/mysql/data/mysql ]; then ...\u0060 to your deployment scripts for idempotency."
    },
    {
      id: "TS-DB-007", category: "Database / HA",
      title: "MariaDB MHA Cluster: Replication Error 1593 & Source Build",
      rootCause: "Slave daemon defaulted to server-id=1 causing an infinite loop block. Standard apt lacked full MHA dependencies for automated failover.",
      resolution: "Corrected server-ids (Master=1, Slave1=2, Slave2=3). Compiled MHA Manager from source. Established bidirectional passwordless SSH trust.",
      cliMock: "[ERROR] Last_IO_Errno: 1593\n[ERROR] Fatal error: master and slave have equal MySQL server ids\n$ ssh root@db-slave-01\n$ sed -i 's/server-id=1/server-id=2/' /etc/mysql/my.cnf\n$ systemctl restart mariadb\n$ mysql -e \"STOP SLAVE; START SLAVE; SHOW SLAVE STATUS\\G\" | grep Running\n[INFO] Slave_IO_Running: Yes\n[INFO] Slave_SQL_Running: Yes\n[SUCCESS] Server ID collision resolved. Replication synced.",
      insight: "**[Ansible MHA Automation (auto-failover.yml)]**\n\u0060\u0060\u0060yaml\n- name: Deploy MHA Node Dependencies\n  apt:\n    name: ['libdbd-mysql-perl', 'libconfig-tiny-perl', 'liblog-dispatch-perl', 'libparallel-forkmanager-perl']\n    state: present\n\u0060\u0060\u0060\nPre-defining mandatory dependencies like this allows rapid scaling of Failover clusters and reduces manual risks."
    },
    {
      id: "TS-DB-008", category: "Database / Disaster Recovery",
      title: "MariaDB System DB Corruption Recovery & SSH PAM Bypass for MHA",
      rootCause: "Crash corrupted 'mysql' tablespace. SSH 'UsePAM yes' configuration enforced keyboard-interactive login, overriding RSA Key authentication for MHA.",
      resolution: "Wiped and rebuilt system DB. Used mysqld_safe --skip-grant-tables to restore admin users. Disabled UsePAM in sshd_config to allow MHA passwordless access.",
      cliMock: "[ERROR] OS error: 71, cannot find file /db/data/mysql\n[ERROR] Access Denied for user 'root'\n$ mysqld_safe --skip-grant-tables &\n[INFO] MariaDB started securely bypassing grant tables.\n$ mysql -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpwd';\"\n$ sed -i 's/^UsePAM yes/UsePAM no/' /etc/ssh/sshd_config\n$ systemctl restart sshd\n[SUCCESS] MHA Manager Passwordless SSH authentication successful.",
      insight: "**[L3 Engineer Security Proposal]**\n\u0060UsePAM yes\u0060 overrides MHA's \u0060authorized_keys\u0060 auth by enforcing PAM plugins. Also, since \u0060mysqld_safe\u0060 acts as a backdoor during recovery, ensure you kill the process (\u0060kill -9\u0060) and restart normally to close security gaps."
    },
    {
      id: "TS-IDE-009", category: "DevOps / Tooling",
      title: "VS Code Remote-SSH Connection Failure & Client/Server Cache",
      rootCause: "Windows OpenSSH rejected the .pem key due to over-permissive ACLs. Remote VS Code server daemon was locked/corrupted from a terminated session.",
      resolution: "Disabled Windows ACL inheritance on the key (granting only user control). Executed 'rm -rf ~/.vscode-server' on the remote VM via secondary client to purge cache.",
      cliMock: "[ERROR] Permission denied (publickey).\n[ERROR] Bad owner or permissions on C:\\Users\\...\\.ssh\\config\n# Windows PowerShell (Client)\n> icacls mykey.pem /inheritance:r\n> icacls mykey.pem /grant:r \"%USERNAME%:R\" /remove \"Authenticated Users\" /remove \"BUILTIN\\Administrators\"\n# Ubuntu Remote (Server)\n$ rm -rf ~/.vscode-server\n[SUCCESS] Corrupted daemon cache cleared. Remote-SSH connection established.",
      insight: "**[VS Code Remote Dev Optimization]**\nWhen accessing Linux from Windows, OpenSSH automatically blocks \u0060.pem\u0060 keys if ACL permissions are too open. Disabling inheritance in Windows File Properties (acting like \u0060chmod 400\u0060) solves this immediately."
    },
    {
      id: "TS-WEB-010", category: "Middleware / Web-WAS",
      title: "Apache2 & Tomcat 9 Integration Failure: AJP Security Mismatch",
      rootCause: "Tomcat 9.0.31+ disabled AJP by default and forced secretRequired=\"true\" binding to 127.0.0.1 (Ghostcat patch). mod_jk requests were rejected.",
      resolution: "Enabled AJP Connector in server.xml with address=\"0.0.0.0\" and secretRequired=\"false\" (or mapped secrets). Configured JkMount correctly in Apache.",
      cliMock: "[ERROR] 503 Service Unavailable\n[ERROR] ajp_connect_to_endpoint::jk_ajp_common.c (1064): failed to connect to Tomcat AJP\n$ vi /usr/local/tomcat/conf/server.xml\n[INFO] Uncommented AJP Connector and added address=\"0.0.0.0\" secretRequired=\"false\"\n$ vi /etc/apache2/workers.properties\n$ systemctl restart tomcat9 apache2\n[SUCCESS] HTTP 200 OK. Apache successfully reverse-proxied to Tomcat via AJP.",
      insight: "**[Ghostcat (CVE-2020-1938) Security Guide]**\nApplying \u0060secretRequired=\"false\"\u0060 is convenient for simple integrations, but in production, keeping \u0060secretRequired=\"true\"\u0060 and syncing \u0060secret=\"MyStrongKey\"\u0060 across \u0060server.xml\u0060 and \u0060workers.properties\u0060 is the security standard against internal AJP sniffing."
    }
  ]
};

const dict = {
  ko: {
    title: "Infra Troubleshooting",
    subtitle: "AI AGENT",
    initMsg: "안녕하세요. 인프라 트러블슈팅 AI 에이전트입니다. 궁금한 점은 자유롭게 채팅에 남겨주세요.",
    urgencyBtn: "🚨 긴급 장애",
    statsTitle: "KB 장애 통계",
    finopsTitle: "FinOps 토큰 모니터링",
    totalUsage: "총 사용량",
    inputLabel: "입력",
    outputLabel: "출력",
    lastLabel: "Last:",
    actionReq: "Action Required",
    cliRun: "CLI 트러블슈팅 실행",
    ongoingTitle: "진행 중인 장애 내역",
    noOngoing: "현재 진행 중인 장애가 없습니다.",
    sysAnal: "System Analysis",
    agent: "AI Agent",
    you: "You",
    catHelp: "자주 발생하는 장애 카테고리",
    inputPlaceholder: "장애 증상이나 기술 질문을 자유롭게 입력하세요 (이 경우만 AI 호출)...",
    rcaGen: "원인(RCA) 분석 및 조치 방안 생성 중...",
    simRcaMsg: "🚨 **[긴급 장애 감지 및 분석 완료]**\n장애 내역: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nCLI 트러블슈팅 실행 버튼을 클릭하여 복구를 진행하세요.",
    cachedReply: "**[{title}]** 장애 내용에 대한 분석 및 조치 가이드입니다.\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\n상세 터미널 로그 및 자동화 스크립트는 좌측의 **[CLI 트러블슈팅 실행]** 버튼을 클릭하여 확인하세요.",
    cliContent: "복구 파이프라인 및 터미널 엑세스를 통해 조치를 시작합니다.\n\n\u0060\u0060\u0060bash\n{cliMock}\n\u0060\u0060\u0060\n\n{insight}",
    cacheHit: "Last: 0 토큰 (Cache Hit - 비용 0원)",
    apiHit: "Last: {tokens} 토큰 (API 호출)",
    categories: {
      "OS / GUI": "OS 장애",
      "Cloud / Network": "네트워크 장애",
      "Storage / Middleware": "스토리지 장애",
      "Cloud / Kubernetes": "K8s 장애",
      "Cloud / IaC": "IaC 장애",
      "Database / HA": "DB 장애",
      "Database / Disaster Recovery": "DB 장애",
      "DevOps / Tooling": "DevOps 장애",
      "Middleware / Web-WAS": "웹/미들웨어 장애"
    }
  },
  en: {
    title: "Infra Troubleshooting",
    subtitle: "AI AGENT",
    initMsg: "Hello. I am the Infra Troubleshooting AI Agent. Feel free to leave any questions in the chat.",
    urgencyBtn: "🚨 Critical Alert",
    statsTitle: "KB Incident Stats",
    finopsTitle: "FinOps Token Monitor",
    totalUsage: "Total Usage",
    inputLabel: "Input",
    outputLabel: "Output",
    lastLabel: "Last:",
    actionReq: "Action Required",
    cliRun: "Run CLI Troubleshooting",
    ongoingTitle: "Ongoing Incidents",
    noOngoing: "No ongoing incidents at the moment.",
    sysAnal: "System Analysis",
    agent: "AI Agent",
    you: "You",
    catHelp: "Frequent Incident Categories",
    inputPlaceholder: "Describe incident symptoms or tech queries freely (AI called only here)...",
    rcaGen: "Analyzing RCA & Generating Resolution...",
    simRcaMsg: "🚨 **[Critical Incident Detected & RCA Complete]**\nIncident: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nPlease click the Run CLI Troubleshooting button to proceed with recovery.",
    cachedReply: "Here is the analysis and resolution guide for **[{title}]**.\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\nPlease check the detailed terminal logs and automation scripts by clicking the **[Run CLI Troubleshooting]** button on the left.",
    cliContent: "Initiating recovery through the pipeline and terminal access.\n\n\u0060\u0060\u0060bash\n{cliMock}\n\u0060\u0060\u0060\n\n{insight}",
    cacheHit: "Last: 0 Tokens (Cache Hit - $0)",
    apiHit: "Last: {tokens} Tokens (API Call)",
    categories: {
      "OS / GUI": "OS Issue",
      "Cloud / Network": "Network Issue",
      "Storage / Middleware": "Storage Issue",
      "Cloud / Kubernetes": "K8s Issue",
      "Cloud / IaC": "IaC Issue",
      "Database / HA": "DB Issue",
      "Database / Disaster Recovery": "DB Issue",
      "DevOps / Tooling": "DevOps Issue",
      "Middleware / Web-WAS": "Web/Middleware"
    }
  }
};

const parseMessageBlocks = (text) => {
  if (!text) return [];
  const blocks = [];
  const bt3 = String.fromCharCode(96, 96, 96);
  const regex = new RegExp(`(<RCA>([\\s\\S]*?)<\\/RCA>|<RES>([\\s\\S]*?)<\\/RES>|${bt3}(bash|sh|shell|yaml|yml|hcl|json)?\\n([\\s\\S]*?)${bt3})`, "g");
  
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      blocks.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    }
    if (match[1].startsWith('<RCA>')) {
      blocks.push({ type: 'rca', content: match[2].trim() });
    } else if (match[1].startsWith('<RES>')) {
      blocks.push({ type: 'res', content: match[3].trim() });
    } else if (match[1].startsWith(bt3)) {
      const langMatch = (match[4] || '').toLowerCase();
      if (['yaml', 'yml', 'hcl', 'json'].includes(langMatch)) {
        blocks.push({ type: 'script', lang: langMatch, content: match[5].trim() });
      } else {
        blocks.push({ type: 'cli', content: match[5].trim() });
      }
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    blocks.push({ type: 'text', content: text.substring(lastIdx) });
  }

  return blocks;
};

const TextStream = ({ text, animate, onDone, scrollRef }) => {
  const [displayed, setDisplayed] = useState(animate ? '' : text);
  const finishedRef = useRef(!animate);
  
  useEffect(() => {
    if (finishedRef.current || !animate) {
      setDisplayed(text);
      if (onDone && animate) onDone();
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i));
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); 
      i += 3;
      if (i >= text.length) {
        setDisplayed(text);
        finishedRef.current = true;
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 10);
    return () => clearInterval(timer);
  }, [animate, text, onDone, scrollRef]);

  const formattedText = displayed
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-600 dark:text-indigo-400">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  
  return (
    <div 
      className="mb-3 leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200"
      dangerouslySetInnerHTML={{ __html: formattedText }} 
    />
  );
};

const RcaCardStream = ({ text, animate, onDone, scrollRef, lang }) => {
  const [displayed, setDisplayed] = useState(animate ? '' : text);
  const finishedRef = useRef(!animate);

  useEffect(() => {
    if (finishedRef.current || !animate) {
      setDisplayed(text);
      if (onDone && animate) onDone();
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i));
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      i += 3;
      if (i >= text.length) {
        setDisplayed(text);
        finishedRef.current = true;
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 10);
    return () => clearInterval(timer);
  }, [animate, text, onDone, scrollRef]);

  return (
    <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-r-xl p-4 my-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 font-bold text-sm uppercase tracking-wider">
        <AlertCircle className="w-4 h-4" />
        {lang === 'ko' ? 'Root Cause Analysis (원인 분석)' : 'Root Cause Analysis'}
      </div>
      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {displayed}
      </div>
    </div>
  );
};

const ResCardStream = ({ text, animate, onDone, scrollRef, lang }) => {
  const [displayed, setDisplayed] = useState(animate ? '' : text);
  const finishedRef = useRef(!animate);

  useEffect(() => {
    if (finishedRef.current || !animate) {
      setDisplayed(text);
      if (onDone && animate) onDone();
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i));
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      i += 3;
      if (i >= text.length) {
        setDisplayed(text);
        finishedRef.current = true;
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 10);
    return () => clearInterval(timer);
  }, [animate, text, onDone, scrollRef]);

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 rounded-r-xl p-4 my-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm uppercase tracking-wider">
        <CheckCircle className="w-4 h-4" />
        {lang === 'ko' ? 'Resolution (조치 방안)' : 'Resolution'}
      </div>
      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {displayed}
      </div>
    </div>
  );
};

const CLIStream = ({ code, animate, onDone, scrollRef }) => {
  const [visibleLines, setVisibleLines] = useState(animate ? [] : code.trim().split('\n'));
  const finishedRef = useRef(!animate);
  
  useEffect(() => {
    const currentLines = code.trim().split('\n');
    if (finishedRef.current || !animate) {
      setVisibleLines(currentLines);
      if (onDone && animate) onDone();
      return;
    }
    
    let i = 0;
    const timer = setInterval(() => {
      setVisibleLines(currentLines.slice(0, i + 1));
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      i++;
      if (i >= currentLines.length) {
        finishedRef.current = true;
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 300); 
    return () => clearInterval(timer);
  }, [animate, code, onDone, scrollRef]);

  const renderLine = (l) => {
    if (l.startsWith('[ERROR]')) return <span className="text-red-400 font-bold">{l}</span>;
    if (l.startsWith('[INFO]')) return <span className="text-blue-400">{l}</span>;
    if (l.startsWith('[SUCCESS]')) return <span className="text-emerald-400 font-bold">{l}</span>;
    if (l.startsWith('$')) return <><span className="text-indigo-500 mr-2 select-none">$</span><span className="text-green-300">{l.substring(1)}</span></>;
    if (l.startsWith('>')) return <><span className="text-indigo-500 mr-2 select-none">{'>'}</span><span className="text-green-300">{l.substring(1)}</span></>;
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
        {animate && visibleLines.length < code.trim().split('\n').length && (
          <div className="flex">
            <span className="text-indigo-500 mr-3 select-none">$</span>
            <span className="w-2.5 h-4 bg-slate-400 animate-pulse"></span>
          </div>
        )}
      </div>
    </div>
  );
};

const ScriptStream = ({ code, lang, animate, onDone, scrollRef }) => {
  const [visibleLines, setVisibleLines] = useState(animate ? [] : code.trim().split('\n'));
  const finishedRef = useRef(!animate);
  
  useEffect(() => {
    const currentLines = code.trim().split('\n');
    if (finishedRef.current || !animate) {
      setVisibleLines(currentLines);
      if (onDone && animate) onDone();
      return;
    }
    
    let i = 0;
    const timer = setInterval(() => {
      setVisibleLines(currentLines.slice(0, i + 1));
      scrollRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      i++;
      if (i >= currentLines.length) {
        finishedRef.current = true;
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, 200); 
    return () => clearInterval(timer);
  }, [animate, code, onDone, scrollRef]);

  return (
    <div className="bg-[#1e1e1e] dark:bg-[#1e1e1e] text-slate-300 p-4 rounded-xl font-mono text-sm shadow-2xl border border-slate-700/80 my-4 overflow-hidden relative group">
      <div className="flex gap-2 mb-3 border-b border-slate-700 pb-3 items-center">
         <Cpu className="w-4 h-4 text-indigo-400" />
         <span className="text-slate-400 text-xs font-sans font-bold uppercase tracking-widest">{lang || 'Script'} Automation</span>
      </div>
      <div className="space-y-1 break-all">
        {visibleLines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap">{l}</div>
        ))}
        {animate && visibleLines.length < code.trim().split('\n').length && (
          <div className="w-2.5 h-4 bg-slate-400 animate-pulse mt-1"></div>
        )}
      </div>
    </div>
  );
};

const SequenceRenderer = ({ msgId, blocks, isNew, lang, scrollRef, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(isNew ? 0 : blocks.length);

  useEffect(() => {
    if (!isNew) setCurrentIndex(blocks.length);
  }, [isNew, blocks.length]);

  useEffect(() => {
    if (isNew && currentIndex >= blocks.length) {
      if (onComplete) onComplete(msgId);
    }
  }, [currentIndex, blocks.length, isNew, msgId, onComplete]);

  return (
    <div className="space-y-1">
      {blocks.map((block, idx) => {
        if (idx > currentIndex) return null;
        if (block.type === 'text') {
          return <TextStream key={idx} text={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} scrollRef={scrollRef} />;
        }
        if (block.type === 'rca') {
          return <RcaCardStream key={idx} text={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} scrollRef={scrollRef} lang={lang} />;
        }
        if (block.type === 'res') {
          return <ResCardStream key={idx} text={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} scrollRef={scrollRef} lang={lang} />;
        }
        if (block.type === 'cli') {
          return <CLIStream key={idx} code={block.content} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} scrollRef={scrollRef} />;
        }
        if (block.type === 'script') {
          return <ScriptStream key={idx} code={block.content} lang={block.lang} animate={isNew && idx === currentIndex} onDone={() => setCurrentIndex(i => i + 1)} scrollRef={scrollRef} />;
        }
        return null;
      })}
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState('ko');
  const [theme, setTheme] = useState('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map(m => ({ ...m, isNew: false })); 
        } catch (e) {
          console.error("Local storage parsing error", e);
        }
      }
    }
    return [];
  });
  
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ id: 'init-1', role: 'assistant', type: 'INIT', isNew: false }]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.map(m => ({ ...m, isNew: false }));
      localStorage.setItem('chat_history', JSON.stringify(toSave));
    }
  }, [messages]);

  const markMessageAsOld = useCallback((id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isNew: false } : m));
  }, []);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [activeCLIAction, setActiveCLIAction] = useState(null); 
  const [tokens, setTokens] = useState({ input: 0, output: 0, total: 0, type: 'NONE', count: 0 });
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  
  const t = dict[lang];

  const categoryCounts = kbData[lang].reduce((acc, curr) => {
    const localizedCatName = t.categories[curr.category] || curr.category;
    acc[localizedCatName] = (acc[localizedCatName] || 0) + 1;
    return acc;
  }, {});
  const maxCategoryCount = Math.max(...Object.values(categoryCounts));

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

  const translateMessage = async (text, targetLang, msgId) => {
    const prompt = `Translate the following IT/infrastructure text to ${targetLang === 'ko' ? 'Korean' : 'English'}. Keep IT terminologies (like EKS, OOMKilled, Nginx, WAS) in English if appropriate. Return ONLY the translated text.\n\nText: ${text}`;
    try {
      const res = await fetchGemini({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "You are an expert IT translator. Provide direct translation without any markdown wrapping or conversational fillers." }] }
      });
      const translatedText = res.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translatedText) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: { ...m.content, [targetLang]: translatedText.trim() } } : m));
        if (res.usageMetadata) {
           setTokens(prev => ({ ...prev, total: prev.total + res.usageMetadata.totalTokenCount }));
        }
      }
    } catch (e) {
      console.error("Bg translation err", e);
    }
  };

  const retrieveContext = (query) => {
    const q = query.toLowerCase();
    const matches = kbData[lang].filter(item => 
      item.title.toLowerCase().includes(q) || item.rootCause.toLowerCase().includes(q) || item.resolution.toLowerCase().includes(q)
    );
    if (matches.length === 0) return kbData[lang].map(d => `[${d.id}] ${d.title}`).join('\n');
    return matches.map(m => `ID: ${m.id}\nTitle: ${m.title}\nRoot Cause: ${m.rootCause}\nResolution: ${m.resolution}\nCLI Mock: ${m.cliMock}\nInsight: ${m.insight}`).join('\n\n');
  };

  const handleCategoryClick = (localizedCatName) => {
    const issues = kbData[lang].filter(item => {
      const catName = t.categories[item.category] || item.category;
      return catName === localizedCatName;
    });
    
    if (issues.length === 0) return;
    const item = issues[Math.floor(Math.random() * issues.length)];

    const userMsgId = Date.now().toString() + "-u";
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', type: 'CATEGORY_PROMPT', category: item.category, isNew: false }]);
    setTokens(prev => ({ ...prev, type: 'CACHE', count: 0 }));

    setTimeout(() => {
      const aiMsgId = Date.now().toString() + "-a";
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', type: 'CACHED_RCA', caseId: item.id, isNew: true }]);
      setActiveCLIAction(item.id);
      setIsMobileMenuOpen(false);
    }, 400);
  };

  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isLoading) return;

    setInput('');
    const userMsgId = Date.now().toString() + "-u";
    setMessages(prev => [...prev, { 
      id: userMsgId, role: 'user', type: 'CUSTOM_CHAT', 
      content: { ko: null, en: null, [lang]: userText }, 
      originalLang: lang, isNew: false 
    }]);
    setIsLoading(true);

    const targetLang = lang === 'ko' ? 'en' : 'ko';
    translateMessage(userText, targetLang, userMsgId);

    const context = retrieveContext(userText);
    
    const systemInstruction = `당신은 인프라 트러블슈팅 AI 에이전트입니다.
[지침]:
1. 기술적 검증: 답변을 생성하기 전, 아키텍처 원리와 장애 해결책이 기술적으로 100% 정확한지 속으로 면밀하게 교차 검증하세요.
2. 톤앤매너: 현재 언어 설정(${lang === 'ko' ? '한국어' : 'English'})에 맞추어 전문적이고 신뢰감 있는 톤으로 답변하세요.

[상황 A: 사용자의 질문이 아래 'Knowledge Base' 항목과 일치하거나 거의 유사한 경우]
- 반드시 답변 첫 줄에 "[MATCHED_KB_ID: 해당ID]" 를 출력하세요. (예: [MATCHED_KB_ID: TS-LINUX-001])
- 원인(RCA)은 <RCA>...</RCA>, 조치 방안(Resolution)은 <RES>...</RES> 태그로 감싸서 설명하세요.
- 마크다운 코드 블록(bash, yaml 등)은 절대 출력하지 마세요!
- 답변 마지막에 반드시 "상세 터미널 로그 및 자동화 스크립트는 좌측의 **[${t.cliRun}]** 버튼을 클릭하여 확인하세요." 라고 안내하세요.

[상황 B: 사용자의 질문이 'Knowledge Base'에 없는 새로운 장애이거나 일반 기술 질문인 경우]
- MATCHED_KB_ID 태그를 절대 출력하지 마세요.
- 원인(RCA)과 조치 방안(Resolution)을 <RCA>, <RES> 태그로 감싸서 논리적으로 설명하세요.
- 터미널 커맨드, 로그, 자동화 스크립트(Terraform, Ansible 등)가 필요하다면 반드시 마크다운 코드 블록(\u0060\u0060\u0060bash, \u0060\u0060\u0060yaml 등)을 사용하여 직접 작성해 제공하세요.
- "버튼을 클릭하여 확인하세요"와 같은 안내 문구는 절대 출력하지 마세요. (버튼이 없기 때문입니다.)

[Knowledge Base]:
${kbData[lang].map(m => `ID: ${m.id}\nTitle: ${m.title}\nRoot Cause: ${m.rootCause}\nResolution: ${m.resolution}`).join('\n\n')}
`;

    const contents = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type === 'CUSTOM_CHAT')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content[lang] || m.content[m.originalLang] }]
      }));
    contents.push({ role: 'user', parts: [{ text: userText }] });

    try {
      const result = await fetchGemini({ contents, systemInstruction: { parts: [{ text: systemInstruction }] } });
      let reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      
      const matchIdRegex = /\[MATCHED_KB_ID:\s*([A-Z0-9-]+)\]/i;
      const match = reply.match(matchIdRegex);
      let matchedId = null;
      
      if (match) {
        matchedId = match[1];
        reply = reply.replace(matchIdRegex, '').trim(); 
      }

      if (result.usageMetadata) {
        setTokens(prev => ({
          input: prev.input + result.usageMetadata.promptTokenCount,
          output: prev.output + result.usageMetadata.candidatesTokenCount,
          total: prev.total + result.usageMetadata.totalTokenCount,
          type: 'API',
          count: result.usageMetadata.totalTokenCount
        }));
      }

      const aiMsgId = Date.now().toString() + "-a";
      setMessages(prev => [...prev, { 
        id: aiMsgId, role: 'assistant', type: 'CUSTOM_CHAT', 
        content: { ko: null, en: null, [lang]: reply }, 
        originalLang: lang, isNew: true 
      }]);
      
      translateMessage(reply, targetLang, aiMsgId);

      if (matchedId) {
        setActiveCLIAction(matchedId); 
      } else {
        setActiveCLIAction(null); 
      }

    } catch (error) {
      const errMsgId = Date.now().toString() + "-e";
      setMessages(prev => [...prev, { 
        id: errMsgId, role: 'assistant', type: 'CUSTOM_CHAT', 
        content: { ko: null, en: null, [lang]: `Error: ${error.message}` }, 
        originalLang: lang, isNew: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerSelectedSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setIsMobileMenuOpen(false); 
    
    const randomIdx = Math.floor(Math.random() * kbData[lang].length);
    const targetCase = kbData[lang][randomIdx];
    const categoryLabel = t.categories[targetCase.category] || targetCase.category;
    
    const incidents = [
      { id: `INC-${Date.now()}-1`, msg: `🚨 [${categoryLabel}] ${targetCase.title}`, icon: <AlertCircle className="w-5 h-5 text-red-500" />, color: "border-red-500/50 bg-red-50 dark:bg-red-500/10" },
      { id: `INC-${Date.now()}-2`, msg: `💬 #incident-response`, icon: <MessageSquare className="w-5 h-5 text-blue-500 dark:text-blue-400" />, color: "border-blue-500/50 bg-blue-50 dark:bg-blue-500/10" },
      { id: `INC-${Date.now()}-3`, msg: `📧 RCA Status: Analyzing`, icon: <Mail className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />, color: "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10" }
    ];

    setToasts(incidents);
    setActiveIncidents(incidents);

    setTimeout(() => {
      setToasts([]);
      const sysMsgId = Date.now().toString() + "-sys";
      setMessages(prev => [...prev, { id: sysMsgId, role: 'system', type: 'SIM_RCA', caseId: targetCase.id, isNew: true }]);
      setActiveCLIAction(targetCase.id); 
    }, 5000);
  };

  const handleCLIAction = (actionId) => {
    setActiveCLIAction(null); 
    const cliMsgId = Date.now().toString() + "-cli";
    setMessages(prev => [...prev, { id: cliMsgId, role: 'assistant', type: 'CLI_ACTION', caseId: actionId, isNew: true }]);
    setActiveIncidents([]); 
    setIsSimulating(false);
  };

  const getDynamicContent = (msg, currentLang) => {
    if (msg.type === 'CUSTOM_CHAT') {
      return msg.content[currentLang] || msg.content[msg.originalLang] || "";
    }
    
    if (msg.type === 'INIT') return dict[currentLang].initMsg;

    if (msg.type === 'CATEGORY_PROMPT') {
      const localizedCat = dict[currentLang].categories[msg.category] || msg.category;
      return `[${localizedCat}] ${currentLang === 'ko' ? '관련 대표적인 장애 원인과 해결 방법을 알려줘.' : 'Provide the RCA and resolution for this issue category.'}`;
    }
    
    const kb = kbData[currentLang].find(c => c.id === msg.caseId);
    if (!kb) return msg.content || "";

    if (msg.type === 'SIM_RCA') {
      return dict[currentLang].simRcaMsg.replace('{title}', kb.title).replace('{rootCause}', kb.rootCause);
    }
    if (msg.type === 'CACHED_RCA') {
      return dict[currentLang].cachedReply.replace('{title}', kb.title).replace('{rootCause}', kb.rootCause).replace('{resolution}', kb.resolution);
    }
    if (msg.type === 'CLI_ACTION') {
      return dict[currentLang].cliContent.replace('{cliMock}', kb.cliMock).replace('{insight}', kb.insight);
    }
    return "";
  };

  const getLatestTokenStr = () => {
    if (tokens.type === 'CACHE') return t.cacheHit;
    if (tokens.type === 'API') return t.apiHit.replace('{tokens}', tokens.count.toLocaleString());
    return `${t.lastLabel} None`;
  };

  return (
    <div className="h-screen flex flex-col md:flex-row font-sans overflow-hidden bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      {/* Toast Notifications */}
      <div className="absolute top-4 right-4 z-50 space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all animate-in slide-in-from-right-8 ${toast.color}`}>
            {toast.icon}
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{toast.msg}</span>
          </div>
        ))}
      </div>

      {/* Mobile Overlay Background */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0`}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white tracking-wide text-[17px] leading-tight">{t.title}</h1>
              <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-mono tracking-widest">{t.subtitle}</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
          <button 
            onClick={triggerSelectedSimulation}
            disabled={isSimulating}
            className="w-full bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all group"
          >
            <BellRing className={`w-4 h-4 ${!isSimulating && 'group-hover:animate-wiggle'}`} /> {t.urgencyBtn}
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner mb-6">
            <h3 className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-bold">
              <BarChart3 className="w-3.5 h-3.5" /> {t.statsTitle}
            </h3>
            <div className="space-y-2.5">
              {Object.entries(categoryCounts).map(([catName, count]) => {
                const percent = (count / maxCategoryCount) * 100;
                return (
                  <div key={catName} className="flex items-center gap-3">
                    <div className="w-16 text-[10px] text-slate-600 dark:text-slate-500 font-bold truncate" title={catName}>{catName}</div>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 w-4 text-right font-bold">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <h2 className="text-[11px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> {t.finopsTitle}
          </h2>
          <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner mb-6">
            <div className="text-center mb-4 pb-4 border-b border-slate-200 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1 font-bold">{t.totalUsage}</span>
              <span className="text-3xl font-light text-slate-900 dark:text-white">{tokens.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-600 dark:text-slate-500 font-bold">{t.inputLabel}</span>
              <span className="text-indigo-600 dark:text-indigo-300 font-bold">{tokens.input.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mb-4 pb-4 border-b border-slate-200 dark:border-slate-800/50">
              <span className="text-slate-600 dark:text-slate-500 font-bold">{t.outputLabel}</span>
              <span className="text-teal-600 dark:text-teal-300 font-bold">{tokens.output.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-slate-500 text-center font-bold text-green-600 dark:text-green-400">
               {getLatestTokenStr()}
            </div>
          </div>

          {activeCLIAction && (
            <div className="mt-auto pt-4 animate-in slide-in-from-bottom-5 hidden md:block">
              <h2 className="text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-widest mb-2 text-center">{t.actionReq}</h2>
              <button
                onClick={() => handleCLIAction(activeCLIAction)}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all border border-green-400 animate-pulse"
              >
                <Zap className="w-5 h-5 fill-current" /> {t.cliRun}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main UI Area */}
      <main className="flex-1 flex flex-col h-full relative bg-slate-50 dark:bg-[#0B1120]">
        <header className="h-14 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex justify-between md:justify-end items-center px-4 md:px-6 z-20 shrink-0 gap-4 transition-colors duration-300">
           
           <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white">
             <Menu className="w-6 h-6" />
           </button>

           <div className="flex items-center gap-4">
             <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} className="text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors">
               {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>

             <button onClick={() => setLang(prev => prev === 'ko' ? 'en' : 'ko')} className="flex items-center gap-1 text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors">
               <Globe className="w-5 h-5" />
               <span className="text-xs font-bold uppercase">{lang}</span>
             </button>

             <div className="relative cursor-pointer" onClick={() => setIsNotifOpen(!isNotifOpen)}>
               <BellRing className={`w-5 h-5 transition-colors ${isNotifOpen ? 'text-indigo-600 dark:text-white' : 'text-slate-400 hover:text-indigo-500 dark:hover:text-white'}`} />
               {activeIncidents.length > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                 </span>
               )}
               
               <div className={`absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl transition-all duration-200 p-2 ${isNotifOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 px-2 pt-1 uppercase">{t.ongoingTitle}</h3>
                  {activeIncidents.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center font-medium">{t.noOngoing}</div>
                  ) : activeIncidents.map(inc => (
                    <div key={inc.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg mb-2 last:mb-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 leading-relaxed font-bold">
                        {inc.icon} {inc.msg}
                      </p>
                    </div>
                  ))}
               </div>
             </div>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';
              
              const dynamicContent = getDynamicContent(msg, lang);
              const blocks = parseMessageBlocks(dynamicContent);

              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`
                    max-w-[95%] md:max-w-[85%] rounded-2xl p-5 shadow-sm
                    ${isUser 
                      ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-tr-none' 
                      : isSystem 
                        ? 'bg-red-50 dark:bg-slate-900 border-2 border-red-500/30 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-lg'
                    }
                  `}>
                    <div className={`flex items-center gap-2 mb-3 border-b pb-2 ${isUser ? 'opacity-80 border-indigo-300 dark:border-white/20' : 'opacity-60 border-slate-300 dark:border-slate-600'}`}>
                      {isUser ? <Smartphone className="w-4 h-4" /> : isSystem ? <ShieldAlert className="w-4 h-4 text-red-500 dark:text-red-400" /> : <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isUser ? t.you : isSystem ? t.sysAnal : t.agent}
                      </span>
                    </div>
                    
                    <div className="text-sm md:text-base break-words font-medium">
                      <SequenceRenderer 
                        msgId={msg.id} 
                        blocks={blocks} 
                        isNew={msg.isNew} 
                        lang={lang} 
                        scrollRef={messagesEndRef} 
                        onComplete={markMessageAsOld} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none p-5 flex items-center gap-4 shadow-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold animate-pulse">{t.rcaGen}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
            
            {/* 모바일 화면용 여백 (FAB에 가려지는 것 방지) */}
            {activeCLIAction && <div className="h-16 md:hidden"></div>}
          </div>
        </div>

        {/* --- 모바일 전용 플로팅 액션 버튼 (FAB) --- */}
        {activeCLIAction && (
          <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] animate-in slide-in-from-bottom-5">
            <button
              onClick={() => handleCLIAction(activeCLIAction)}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(34,197,94,0.4)] transition-all border border-green-400 animate-bounce"
            >
              <Zap className="w-5 h-5 fill-current" /> {t.cliRun}
            </button>
          </div>
        )}

        <div className="bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex flex-col pb-safe shrink-0 transition-colors duration-300 relative z-30">
          
          <div className="max-w-4xl mx-auto w-full px-4 pt-4">
            <div className="text-xs text-slate-500 font-bold mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" /> {t.catHelp}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {Object.keys(categoryCounts).map((catName) => {
                return (
                  <button 
                    key={catName}
                    onClick={() => handleCategoryClick(catName)} 
                    disabled={isLoading}
                    className="text-[11px] whitespace-nowrap shrink-0 font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-indigo-600 dark:text-indigo-300 border border-slate-300 dark:border-slate-700 px-3.5 py-2.5 rounded-lg transition-colors shadow-sm"
                  >
                    {catName}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="max-w-4xl mx-auto w-full p-4 pt-2">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.inputPlaceholder}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
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
