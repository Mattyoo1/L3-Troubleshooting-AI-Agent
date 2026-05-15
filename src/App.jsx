import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Terminal, BellRing, Cpu, PlayCircle, AlertCircle, 
  MessageSquare, Mail, Smartphone, ShieldAlert, Activity, 
  HelpCircle, Loader2, Send, BarChart3, Globe, Sun, Moon,
  Menu, X, CheckCircle, Zap, Calendar, CalendarDays, Key, Trash2,
  Search, FileCode, Server, AlertTriangle, ArrowRight, User, Lock
} from 'lucide-react';

// === 1. 파싱 에러 원천 차단 (백틱 동적 생성 - 캔버스 렌더링 보호) ===
const BQ = String.fromCharCode(96);
const TBQ = BQ + BQ + BQ;

// --- 사내 지식 베이스 (Troubleshooting Data - 다국어 지원) ---
const kbData = {
  ko: [
    {
      id: "TS-LINUX-001", category: "OS / GUI",
      title: "Ubuntu 22.04 XRDP 블랙 스크린 및 Polkit 충돌",
      rootCause: "기본 Gnome 세션과 XRDP 간의 충돌 및 너무 엄격한 polkit 규칙으로 인해 콘솔 외부 사용자의 color managed device 생성이 차단됨.",
      resolution: "~/.xsession 파일에 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'을 작성하고, colord를 허용하는 사용자 지정 polkit .pkla 파일을 추가함.",
      cliMock: "[ERROR] xrdp_mm_process_login_response: login failed\n$ echo 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session' > ~/.xsession\n$ sudo bash -c 'cat > /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla <<EOF\n[Allow Colord all Users]\nIdentity=unix-user:*\nAction=org.freedesktop.color-manager.create-device\nResultAny=no\nResultInactive=no\nResultActive=yes\nEOF'\n$ sudo systemctl restart xrdp\n[SUCCESS] RDP Session Established.",
      insight: "**[Ansible 자동화 스크립트 제안 (xrdp-fix.yml)]**\n" + TBQ + "yaml\n- name: Fix XRDP Black Screen\n  hosts: ubuntu_servers\n  tasks:\n    - name: Configure .xsession\n      lineinfile:\n        path: ~/.xsession\n        line: 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'\n        create: yes\n" + TBQ + "\n위와 같이 Ansible로 템플릿화하여 대규모 VDI 프로비저닝 시 휴먼 에러를 방지하세요."
    },
    {
      id: "TS-UBUNTU-002", category: "Cloud / Network",
      title: "엔터프라이즈 보안 FTP (vsftpd) Passive Mode & chroot 리팩토링",
      rootCause: "소켓 바인드 충돌(IPv4/IPv6), NAT에 의해 Active FTP가 차단됨, vsftpd chroot의 엄격한 보안 정책으로 인해 쓰기 가능한 루트 디렉토리가 차단됨.",
      resolution: "IPv6 비활성화, Passive Mode(포트 10000-10100) 활성화, 클라우드 ACG 구성, chroot 디렉토리 권한 분리(루트 550, 하위 750).",
      cliMock: "[ERROR] status=2/INVALIDARGUMENT\n[ERROR] 500 OOPS: cannot read config file\n$ sudo mv /etc/vsftpd.conf /etc/vsftpd.conf.bak\n$ sudo sed -i 's/listen_ipv6=YES/#listen_ipv6=YES/g' /etc/vsftpd.conf\n$ echo -e 'pasv_enable=YES\\npasv_min_port=10000\\npasv_max_port=10100' >> /etc/vsftpd.conf\n$ sudo chmod 550 /home/main/ftp && sudo chmod 750 /home/main/ftp/upload\n$ sudo systemctl restart vsftpd\n[SUCCESS] Passive Mode active and chroot security applied.",
      insight: "**[네트워크/보안 아키텍처 개선 제안]**\nFTP는 패킷이 평문으로 전송되므로, 향후 vsftpd 설정에 " + BQ + "ssl_enable=YES" + BQ + "를 추가하여 FTPS로 전환하거나, 포트 22를 활용하는 SFTP 전용 " + BQ + "Subsystem sftp internal-sftp -d /home/main/ftp" + BQ + " 구조로 일원화하는 것을 강력히 권장합니다."
    },
    {
      id: "TS-TOMCAT-003", category: "Storage / Middleware",
      title: "Tomcat 로그 스토리지 고갈 및 NAS 자동화 파이프라인",
      rootCause: "이중 로깅으로 인한 디스크 비대화. 기존 logrotate가 gzip -c를 사용해 로그를 강제 압축함. 'rm'으로 활성 로그 삭제 시 '고스트 파일'이 발생해 inode 반환이 안 됨.",
      resolution: "catalina.out을 안전하게 롤링하도록 copytruncate 적용. uncompressed 상태로 NAS에 'mv'하도록 postrotate 수정. +90일 압축, +180일 삭제 NAS Cron 구축.",
      cliMock: "[ERROR] Error 28: No space left on device\n$ df -h | grep /dev/sda1\n/dev/sda1       50G   50G     0  100% /\n$ cat /dev/null > /usr/local/tomcat/logs/catalina.out\n[INFO] Ghost File cleared. Disk space reclaimed.\n$ find /mnt/nas/tomcat_logs -name '*.log' -mtime +90 -exec gzip {} \\;\n$ find /mnt/nas/tomcat_logs -name '*.gz' -mtime +180 -delete\n[SUCCESS] NAS Lifecycle policies executed successfully.",
      insight: "**[Shell Script 고도화 제안 (nas_lifecycle.sh)]**\n" + TBQ + "bash\n#!/bin/bash\nNAS_DIR=\"/mnt/nas/tomcat_logs\"\n# 3개월 초과 로그 압축\nfind $NAS_DIR -type f -name '*.log' -mtime +90 -print0 | xargs -0 -I{} gzip -9 {}\n# 6개월 초과 로그 삭제\nfind $NAS_DIR -type f -mtime +180 -delete\n" + TBQ + "\n해당 스크립트를 Crontab에 등록하여 스토리지 100% Full 장애를 영구적으로 예방하세요."
    },
    {
      id: "TS-K8S-004", category: "Cloud / Kubernetes",
      title: "Kubespray K8s 배포: 네트워크 타임아웃 및 x509 PKI 인증 오류",
      rootCause: "ACG 방화벽 포트(2379, 6443, 10250) 차단됨. 자동 생성된 API 서버 인증서의 SAN 목록에 Public IP가 누락되어 외부 kubeconfig 접근 거부됨.",
      resolution: "ACG 포트 개방. 잘못된 인증서를 삭제하고 '--apiserver-cert-extra-sans' 옵션을 주어 kubeadm으로 재발급.",
      cliMock: "[ERROR] connection refused to 192.168.10.6:6443\n[ERROR] tls: failed to verify certificate: x509... not 223.130.134.7\n$ sudo rm -f /etc/kubernetes/pki/apiserver.*\n$ sudo kubeadm init phase certs apiserver --apiserver-cert-extra-sans 223.130.134.7\n[INFO] Generating new API server RSA key and x509 cert...\n$ sudo docker restart $(docker ps -q -f name=k8s_kube-apiserver)\n$ kubectl get nodes -o wide\n[SUCCESS] Kubeconfig connected securely via Public IP.",
      insight: "**[Kubernetes 인프라 보안 개선 제안]**\nKubespray 배포 시 " + BQ + "inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml" + BQ + " 파일 내에 " + BQ + "supplementary_addresses_in_ssl_keys: [\"Public IP\"]" + BQ + " 항목을 미리 선언해 두면 인증서 재발급 수고를 덜 수 있습니다."
    },
    {
      id: "TS-NCP-005", category: "Cloud / IaC",
      title: "NCP Terraform VM Provisioning 실패 및 동적 데이터 소스 리팩토링",
      rootCause: "OS 이미지 및 스펙에 하드코딩된 정적 상품 코드를 사용하여 드리프트 발생. NCP API가 'terraform apply' 중 사용되지 참조되는 이미지 코드를 거부함.",
      resolution: "정규식을 사용하여 런타임에 가장 최신의 호환 가능한 스펙 코드를 동적으로 가져오는 'data' 소스 방식으로 리팩토링.",
      cliMock: "[ERROR] ncloud_server: Bad Request: InvalidServerImageProductCode\n$ vi server.tf\n[INFO] Changing hardcoded 'SVR0000000X' to dynamic data.ncloud_server_image.ubuntu24.id\n$ terraform plan\n[INFO] Plan: 2 to add, 0 to change, 0 to destroy.\n$ terraform apply -auto-approve\n[SUCCESS] VM Provisioned completely with idempotent infrastructure code.",
      insight: "**[Terraform 리팩토링 코드 팁 (server.tf)]**\n" + TBQ + "hcl\ndata \"ncloud_server_image\" \"ubuntu\" {\n  filter {\n    name   = \"product_name\"\n    values = [\"ubuntu-24.04\"]\n    regex  = true\n  }\n}\n" + TBQ + "\n클라우드 벤더의 API 코드는 수시로 변하므로, 항상 " + BQ + "data" + BQ + " 블록을 이용해 런타임에 최신 코드를 쿼리하는 것이 IaC의 핵심입니다."
    },
    {
      id: "TS-DB-006", category: "Database / HA",
      title: "MariaDB MHA 복제: Binlog 실패 및 시스템 테이블 초기화 버그",
      rootCause: "Legacy my.cnf params caused startup halts. Manual binary install bypassed system table creation, leaving 'mysql' DB empty and binlog engine failed.",
      resolution: "Removed deprecated thread_concurrency. Executed mysql_install_db manually to generate core dictionary. Enabled log-bin and exported master snapshot.",
      cliMock: "[ERROR] Error: Binlogging on server not active\n[Warning] 'THREAD_CONCURRENCY' is deprecated\n$ sudo sed -i '/thread_concurrency/s/^/#/' /etc/mysql/my.cnf\n$ sudo /usr/local/mysql/scripts/mysql_install_db --user=mysql --basedir=/usr/local/mysql\n[INFO] Installing MariaDB/MySQL system tables in '/usr/local/mysql/data' ... OK\n$ sudo systemctl restart mariadb\n$ mysqldump -u root -p --all-databases --master-data > all.sql\n[SUCCESS] Binlog active. Master data dump exported.",
      insight: "**[데이터베이스 아키텍처 조언]**\n바이너리 수동 설치 시 " + BQ + "mysql_install_db" + BQ + "가 누락되면 권한, 복제 관리 테이블이 생성되지 않아 치명적입니다. 배포 스크립트에 " + BQ + "if [ ! -d /usr/local/mysql/data/mysql ]; then ..." + BQ + " 방어 로직을 추가하세요."
    },
    {
      id: "TS-DB-007", category: "Database / HA",
      title: "MariaDB MHA 클러스터: 복제 에러 1593 및 소스 빌드",
      rootCause: "Slave daemon defaulted to server-id=1 causing an infinite loop block. Standard apt lacked full MHA dependencies for automated failover.",
      resolution: "server-id 충돌 수정 (Master=1, Slave1=2, Slave2=3). 소스에서 MHA Manager 컴파일 및 양방향 패스워드 없는 SSH 신뢰 구축.",
      cliMock: "[ERROR] Last_IO_Errno: 1593\n[ERROR] Fatal error: master and slave have equal MySQL server ids\n$ ssh root@db-slave-01\n$ sed -i 's/server-id=1/server-id=2/' /etc/mysql/my.cnf\n$ systemctl restart mariadb\n$ mysql -e \"STOP SLAVE; START SLAVE; SHOW SLAVE STATUS\\G\" | grep Running\n[INFO] Slave_IO_Running: Yes\n[INFO] Slave_SQL_Running: Yes\n[SUCCESS] Server ID collision resolved. Replication synced.",
      insight: "**[Ansible을 활용한 MHA 자동화 스크립트 (auto-failover.yml)]**\n" + TBQ + "yaml\n- name: Deploy MHA Node Dependencies\n  apt:\n    name: ['libdbd-mysql-perl', 'libconfig-tiny-perl', 'liblog-dispatch-perl', 'libparallel-forkmanager-perl']\n    state: present\n" + TBQ + "\n필수 의존성 패키지를 미리 정의하여 신속하게 Failover 클러스터를 확장할 수 있습니다."
    },
    {
      id: "TS-DB-008", category: "Database / Disaster Recovery",
      title: "MariaDB 시스템 DB 손상 복구 및 MHA SSH PAM 우회",
      rootCause: "Crash corrupted 'mysql' tablespace. SSH 'UsePAM yes' configuration enforced keyboard-interactive login, overriding RSA Key authentication for MHA.",
      resolution: "Wiped and rebuilt system DB. Used mysqld_safe --skip-grant-tables to restore admin users. Disabled UsePAM in sshd_config to allow MHA passwordless access.",
      cliMock: "[ERROR] OS error: 71, cannot find file /db/data/mysql\n[ERROR] Access Denied for user 'root'\n$ mysqld_safe --skip-grant-tables &\n[INFO] MariaDB started securely bypassing grant tables.\n$ mysql -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpwd';\"\n$ sed -i 's/^UsePAM yes/UsePAM no/' /etc/ssh/sshd_config\n$ systemctl restart sshd\n[SUCCESS] MHA Manager Passwordless SSH authentication successful.",
      insight: "**[L3 엔지니어의 보안 아키텍처 제안]**\n" + BQ + "UsePAM yes" + BQ + " overrides MHA's " + BQ + "authorized_keys" + BQ + " auth by enforcing PAM plugins. Also, since " + BQ + "mysqld_safe" + BQ + " acts as a backdoor during recovery, ensure you kill the process (" + BQ + "kill -9" + BQ + ") and restart normally to close security gaps."
    },
    {
      id: "TS-IDE-009", category: "DevOps / Tooling",
      title: "VS Code Remote-SSH 접속 실패 및 캐시 손상",
      rootCause: "Windows OpenSSH rejected the .pem key due to over-permissive ACLs. Remote VS Code server daemon was locked/corrupted from a terminated session.",
      resolution: "Disabled Windows ACL inheritance on the key (granting only user control). Executed 'rm -rf ~/.vscode-server' on the remote VM via secondary client to purge cache.",
      cliMock: "[ERROR] Permission denied (publickey).\n[ERROR] Bad owner or permissions on C:\\Users\\...\\.ssh\\config\n# Windows PowerShell (Client)\n> icacls mykey.pem /inheritance:r\n> icacls mykey.pem /grant:r \"%USERNAME%:R\" /remove \"Authenticated Users\" /remove \"BUILTIN\\Administrators\"\n# Ubuntu Remote (Server)\n$ rm -rf ~/.vscode-server\n[SUCCESS] Corrupted daemon cache cleared. Remote-SSH connection established.",
      insight: "**[VS Code 원격 개발 환경 최적화 팁]**\n윈도우에서 리눅스로 접근할 때 " + BQ + ".pem" + BQ + " 키의 권한(ACL)이 열려있으면 연결을 차단합니다. 리눅스의 " + BQ + "chmod 400" + BQ + "과 동일하게 파일 속성에서 '상속 해제' 후 본인 계정만 남기면 깔끔하게 해결됩니다."
    },
    {
      id: "TS-WEB-010", category: "Middleware / Web-WAS",
      title: "Apache2 & Tomcat 9 Integration Failure: AJP Security Mismatch",
      rootCause: "Tomcat 9.0.31 이상의 Ghostcat 패치로 인해 AJP가 기본 비활성화되고 secretRequired=\"true\"가 강제되어 mod_jk 요청이 거부됨.",
      resolution: "server.xml에서 AJP Connector를 활성화하고 address=\"0.0.0.0\" 및 secretRequired=\"false\"로 변경. Apache JkMount 설정 재확인.",
      cliMock: "[ERROR] 503 Service Unavailable\n[ERROR] ajp_connect_to_endpoint::jk_ajp_common.c (1064): failed to connect to Tomcat AJP\n$ vi /usr/local/tomcat/conf/server.xml\n[INFO] Uncommented AJP Connector and added address=\"0.0.0.0\" secretRequired=\"false\"\n$ vi /etc/apache2/workers.properties\n$ systemctl restart tomcat9 apache2\n[SUCCESS] HTTP 200 OK. Apache successfully reverse-proxied to Tomcat via AJP.",
      insight: "**[Ghostcat (CVE-2020-1938) 보안 대응 가이드]**\n단순 연동을 위해 " + BQ + "secretRequired=\"false\"" + BQ + "를 적용하는 것은 편하지만, 실무에서는 " + BQ + "secretRequired=\"true\"" + BQ + "를 유지하고 " + BQ + "server.xml" + BQ + "과 " + BQ + "workers.properties" + BQ + " 양쪽에 시크릿 키를 부여하여 내부 AJP 통신의 스니핑을 방어하는 것이 스탠다드입니다."
    }
  ],
  en: [
    {
      id: "TS-LINUX-001", category: "OS / GUI",
      title: "Ubuntu 22.04 XRDP Black Screen & Polkit Crash",
      rootCause: "Default Gnome session conflict with XRDP and overly strict polkit rules blocking non-console users from creating color managed devices.",
      resolution: "Created ~/.xsession with 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'. Added custom polkit .pkla file to allow colord.",
      cliMock: "[ERROR] xrdp_mm_process_login_response: login failed\n$ echo 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session' > ~/.xsession\n$ sudo bash -c 'cat > /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla <<EOF\n[Allow Colord all Users]\nIdentity=unix-user:*\nAction=org.freedesktop.color-manager.create-device\nResultAny=no\nResultInactive=no\nResultActive=yes\nEOF'\n$ sudo systemctl restart xrdp\n[SUCCESS] RDP Session Established.",
      insight: "**[Ansible Automation Script Proposal (xrdp-fix.yml)]**\n" + TBQ + "yaml\n- name: Fix XRDP Black Screen\n  hosts: ubuntu_servers\n  tasks:\n    - name: Configure .xsession\n      lineinfile:\n        path: ~/.xsession\n        line: 'env -u SESSION_MANAGER -u DBUS_SESSION_BUS_ADDRESS gnome-session'\n        create: yes\n" + TBQ + "\nUse Ansible to template this configuration and prevent human errors during large-scale VDI provisioning."
    },
    {
      id: "TS-UBUNTU-002", category: "Cloud / Network",
      title: "Enterprise Secure FTP (vsftpd) Passive Mode & chroot Refactoring",
      rootCause: "Socket bind conflict (IPv4/IPv6), Active FTP blocked by NAT, and vsftpd chroot strict security policy preventing writable root directories.",
      resolution: "Disabled IPv6, enabled Passive Mode (ports 10000-10100), configured Cloud ACG, whitelisted users, and split chroot directory permissions (550 root, 750 sub-dir).",
      cliMock: "[ERROR] status=2/INVALIDARGUMENT\n[ERROR] 500 OOPS: cannot read config file\n$ sudo mv /etc/vsftpd.conf /etc/vsftpd.conf.bak\n$ sudo sed -i 's/listen_ipv6=YES/#listen_ipv6=YES/g' /etc/vsftpd.conf\n$ echo -e 'pasv_enable=YES\\npasv_min_port=10000\\npasv_max_port=10100' >> /etc/vsftpd.conf\n$ sudo chmod 550 /home/main/ftp && sudo chmod 750 /home/main/ftp/upload\n$ sudo systemctl restart vsftpd\n[SUCCESS] Passive Mode active and chroot security applied.",
      insight: "**[Network/Security Architecture Improvement]**\nSince FTP transmits packets in plaintext, it is highly recommended to add " + BQ + "ssl_enable=YES" + BQ + " to vsftpd config for FTPS, or unify the architecture using port 22 with " + BQ + "Subsystem sftp internal-sftp -d /home/main/ftp" + BQ + "."
    },
    {
      id: "TS-TOMCAT-003", category: "Storage / Middleware",
      title: "Tomcat Log Storage Exhaustion & Automated NAS Lifecycle Pipeline",
      rootCause: "Dual-logging bloated disk. Initial logrotate used gzip -c forcefully compressing all logs. Deleting active logs via 'rm' caused 'Ghost File' inode retention.",
      resolution: "Applied copytruncate to safely rotate catalina.out. Changed postrotate to 'mv' logs to NAS uncompressed. Built daily NAS Cron for +90 days gzip and +180 days deletion.",
      cliMock: "[ERROR] Error 28: No space left on device\n$ df -h | grep /dev/sda1\n/dev/sda1       50G   50G     0  100% /\n$ cat /dev/null > /usr/local/tomcat/logs/catalina.out\n[INFO] Ghost File cleared. Disk space reclaimed.\n$ find /mnt/nas/tomcat_logs -name '*.log' -mtime +90 -exec gzip {} \\;\n$ find /mnt/nas/tomcat_logs -name '*.gz' -mtime +180 -delete\n[SUCCESS] NAS Lifecycle policies executed successfully.",
      insight: "**[Shell Script Automation (nas_lifecycle.sh)]**\n" + TBQ + "bash\n#!/bin/bash\nNAS_DIR=\"/mnt/nas/tomcat_logs\"\n# Compress logs older than 90 days\nfind $NAS_DIR -type f -name '*.log' -mtime +90 -print0 | xargs -0 -I{} gzip -9 {}\n# Delete logs older than 180 days\nfind $NAS_DIR -type f -mtime +180 -delete\n" + TBQ + "\nRegister this script in Crontab to permanently prevent 100% storage full incidents."
    },
    {
      id: "TS-K8S-004", category: "Cloud / Kubernetes",
      title: "Kubespray K8s Deployment: Network Timeouts & x509 PKI Cert Resolution",
      rootCause: "ACG blocked ports (2379, 6443, 10250). Auto-generated API server cert lacked Public IP in SAN list, rejecting external kubeconfig access.",
      resolution: "Opened ACG ports. Deleted invalid cert and regenerated via 'kubeadm init phase certs apiserver --apiserver-cert-extra-sans [Public_IP]'.",
      cliMock: "[ERROR] connection refused to 192.168.10.6:6443\n[ERROR] tls: failed to verify certificate: x509... not 223.130.134.7\n$ sudo rm -f /etc/kubernetes/pki/apiserver.*\n$ sudo kubeadm init phase certs apiserver --apiserver-cert-extra-sans 223.130.134.7\n[INFO] Generating new API server RSA key and x509 cert...\n$ sudo docker restart $(docker ps -q -f name=k8s_kube-apiserver)\n$ kubectl get nodes -o wide\n[SUCCESS] Kubeconfig connected securely via Public IP.",
      insight: "**[Kubernetes Infrastructure Security Tip]**\nDuring Kubespray deployment, if you pre-declare " + BQ + "supplementary_addresses_in_ssl_keys: [\"Public IP\"]" + BQ + " in " + BQ + "inventory/mycluster/group_vars/k8s_cluster/k8s-cluster.yml" + BQ + ", the certificate will be issued with the correct SAN automatically."
    },
    {
      id: "TS-NCP-005", category: "Cloud / IaC",
      title: "NCP Terraform VM Provisioning Failure & Dynamic Data Source Refactoring",
      rootCause: "Using hardcoded, static product codes for OS Image and Specs caused drift. NCP API rejected deprecated image codes during 'terraform apply'.",
      resolution: "Refactored to dynamic 'data' sources using regex to fetch the latest Ubuntu 24.04 image and compatible hardware specs at runtime. Secured VPC NIC mapping.",
      cliMock: "[ERROR] ncloud_server: Bad Request: InvalidServerImageProductCode\n$ vi server.tf\n[INFO] Changing hardcoded 'SVR0000000X' to dynamic data.ncloud_server_image.ubuntu24.id\n$ terraform plan\n[INFO] Plan: 2 to add, 0 to change, 0 to destroy.\n$ terraform apply -auto-approve\n[SUCCESS] VM Provisioned completely with idempotent infrastructure code.",
      insight: "**[Terraform Refactoring Tip (server.tf)]**\n" + TBQ + "hcl\ndata \"ncloud_server_image\" \"ubuntu\" {\n  filter {\n    name   = \"product_name\"\n    values = [\"ubuntu-24.04\"]\n    regex  = true\n  }\n}\n" + TBQ + "\nCloud vendor API codes change frequently. Always use the " + BQ + "data" + BQ + " block to dynamically query the latest compatible spec at runtime; this is the core of IaC."
    },
    {
      id: "TS-DB-006", category: "Database / HA",
      title: "MariaDB MHA Replication: Binlog Failure & System Table Init Fix",
      rootCause: "Legacy my.cnf params caused startup halts. Manual binary install bypassed system table creation, leaving 'mysql' DB empty and binlog engine failed.",
      resolution: "Removed deprecated thread_concurrency. Executed mysql_install_db manually to generate core dictionary. Enabled log-bin and exported master snapshot.",
      cliMock: "[ERROR] Error: Binlogging on server not active\n[Warning] 'THREAD_CONCURRENCY' is deprecated\n$ sudo sed -i '/thread_concurrency/s/^/#/' /etc/mysql/my.cnf\n$ sudo /usr/local/mysql/scripts/mysql_install_db --user=mysql --basedir=/usr/local/mysql\n[INFO] Installing MariaDB/MySQL system tables in '/usr/local/mysql/data' ... OK\n$ sudo systemctl restart mariadb\n$ mysqldump -u root -p --all-databases --master-data > all.sql\n[SUCCESS] Binlog active. Master data dump exported.",
      insight: "**[Database Architecture Advice]**\nIf " + BQ + "mysql_install_db" + BQ + " is omitted during manual installation, crucial permission and replication tables won't be created. Add defensive logic like " + BQ + "if [ ! -d /usr/local/mysql/data/mysql ]; then ..." + BQ + " to your deployment scripts for idempotency."
    },
    {
      id: "TS-DB-007", category: "Database / HA",
      title: "MariaDB MHA Cluster: Replication Error 1593 & Source Build",
      rootCause: "Slave daemon defaulted to server-id=1 causing an infinite loop block. Standard apt lacked full MHA dependencies for automated failover.",
      resolution: "Corrected server-ids (Master=1, Slave1=2, Slave2=3). Compiled MHA Manager from source. Established bidirectional passwordless SSH trust.",
      cliMock: "[ERROR] Last_IO_Errno: 1593\n[ERROR] Fatal error: master and slave have equal MySQL server ids\n$ ssh root@db-slave-01\n$ sed -i 's/server-id=1/server-id=2/' /etc/mysql/my.cnf\n$ systemctl restart mariadb\n$ mysql -e \"STOP SLAVE; START SLAVE; SHOW SLAVE STATUS\\G\" | grep Running\n[INFO] Slave_IO_Running: Yes\n[INFO] Slave_SQL_Running: Yes\n[SUCCESS] Server ID collision resolved. Replication synced.",
      insight: "**[Ansible MHA Automation (auto-failover.yml)]**\n" + TBQ + "yaml\n- name: Deploy MHA Node Dependencies\n  apt:\n    name: ['libdbd-mysql-perl', 'libconfig-tiny-perl', 'liblog-dispatch-perl', 'libparallel-forkmanager-perl']\n    state: present\n" + TBQ + "\nPre-defining mandatory dependencies like this allows rapid scaling of Failover clusters and reduces manual risks."
    },
    {
      id: "TS-DB-008", category: "Database / Disaster Recovery",
      title: "MariaDB System DB Corruption Recovery & SSH PAM Bypass for MHA",
      rootCause: "Crash corrupted 'mysql' tablespace. SSH 'UsePAM yes' configuration enforced keyboard-interactive login, overriding RSA Key authentication for MHA.",
      resolution: "Wiped and rebuilt system DB. Used mysqld_safe --skip-grant-tables to restore admin users. Disabled UsePAM in sshd_config to allow MHA passwordless access.",
      cliMock: "[ERROR] OS error: 71, cannot find file /db/data/mysql\n[ERROR] Access Denied for user 'root'\n$ mysqld_safe --skip-grant-tables &\n[INFO] MariaDB started securely bypassing grant tables.\n$ mysql -e \"FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpwd';\"\n$ sed -i 's/^UsePAM yes/UsePAM no/' /etc/ssh/sshd_config\n$ systemctl restart sshd\n[SUCCESS] MHA Manager Passwordless SSH authentication successful.",
      insight: "**[L3 Engineer Security Proposal]**\n" + BQ + "UsePAM yes" + BQ + " overrides MHA's " + BQ + "authorized_keys" + BQ + " auth by enforcing PAM plugins. Also, since " + BQ + "mysqld_safe" + BQ + " acts as a backdoor during recovery, ensure you kill the process (" + BQ + "kill -9" + BQ + ") and restart normally to close security gaps."
    },
    {
      id: "TS-IDE-009", category: "DevOps / Tooling",
      title: "VS Code Remote-SSH Connection Failure & Client/Server Cache",
      rootCause: "Windows OpenSSH rejected the .pem key due to over-permissive ACLs. Remote VS Code server daemon was locked/corrupted from a terminated session.",
      resolution: "Disabled Windows ACL inheritance on the key (granting only user control). Executed 'rm -rf ~/.vscode-server' on the remote VM via secondary client to purge cache.",
      cliMock: "[ERROR] Permission denied (publickey).\n[ERROR] Bad owner or permissions on C:\\Users\\...\\.ssh\\config\n# Windows PowerShell (Client)\n> icacls mykey.pem /inheritance:r\n> icacls mykey.pem /grant:r \"%USERNAME%:R\" /remove \"Authenticated Users\" /remove \"BUILTIN\\Administrators\"\n# Ubuntu Remote (Server)\n$ rm -rf ~/.vscode-server\n[SUCCESS] Corrupted daemon cache cleared. Remote-SSH connection established.",
      insight: "**[VS Code Remote Dev Optimization]**\nWhen accessing Linux from Windows, OpenSSH automatically blocks " + BQ + ".pem" + BQ + " keys if ACL permissions are too open. Disabling inheritance in Windows File Properties (acting like " + BQ + "chmod 400" + BQ + ") solves this immediately."
    },
    {
      id: "TS-WEB-010", category: "Middleware / Web-WAS",
      title: "Apache2 & Tomcat 9 Integration Failure: AJP Security Mismatch",
      rootCause: "Tomcat 9.0.31+ disabled AJP by default and forced secretRequired=\"true\" binding to 127.0.0.1 (Ghostcat patch). mod_jk requests were rejected.",
      resolution: "Enabled AJP Connector in server.xml with address=\"0.0.0.0\" and secretRequired=\"false\" (or mapped secrets). Configured JkMount correctly in Apache.",
      cliMock: "[ERROR] 503 Service Unavailable\n[ERROR] ajp_connect_to_endpoint::jk_ajp_common.c (1064): failed to connect to Tomcat AJP\n$ vi /usr/local/tomcat/conf/server.xml\n[INFO] Uncommented AJP Connector and added address=\"0.0.0.0\" secretRequired=\"false\"\n$ vi /etc/apache2/workers.properties\n$ systemctl restart tomcat9 apache2\n[SUCCESS] HTTP 200 OK. Apache successfully reverse-proxied to Tomcat via AJP.",
      insight: "**[Ghostcat (CVE-2020-1938) Security Guide]**\nApplying " + BQ + "secretRequired=\"false\"" + BQ + " is convenient for simple integrations, but in production, keeping " + BQ + "secretRequired=\"true\"" + BQ + " and syncing " + BQ + "secret=\"MyStrongKey\"" + BQ + " across " + BQ + "server.xml" + BQ + " and " + BQ + "workers.properties" + BQ + " is the security standard against internal AJP sniffing."
    }
  ]
};

const dict = {
  ko: {
    title: "My IT Agent",
    subtitle: "Infra Troubleshooting",
    initMsg: "안녕하세요. 인프라 트러블슈팅 AI 에이전트입니다. 궁금한 점은 자유롭게 채팅에 남겨주세요.",
    urgencyBtn: "🚨 긴급 장애 (Simulate)",
    agenticBtn: "🔎 장애 로그 분석 에이전트",
    agenticTitle: "긴급 로그 분석 워크플로우",
    statsTitle: "KB 장애 통계",
    finopsTitle: "FinOps 토큰 모니터링",
    totalUsage: "총 사용량",
    inputLabel: "입력 (Input)",
    outputLabel: "출력 (Output)",
    transKoLabel: "한글 (EN ➔ KO)",
    transEnLabel: "영어 (KO ➔ EN)",
    lastLabel: "Last:",
    actionReq: "Action Required",
    cliRun: "CLI 트러블슈팅 실행",
    ongoingTitle: "진행 중인 장애 내역",
    noOngoing: "현재 진행 중인 장애가 없습니다.",
    sysAnal: "System Analysis",
    agent: "AI Agent",
    you: "You",
    catHelp: "자주 발생하는 장애 카테고리",
    inputPlaceholder: "장애 증상이나 기술 질문을 자유롭게 입력하세요...",
    rcaGen: "원인(RCA) 분석 및 조치 방안 생성 중...",
    simRcaMsg: "🚨 **[긴급 장애 감지 및 분석 완료]**\n장애 내역: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nCLI 트러블슈팅 실행 버튼을 클릭하여 복구를 진행하세요.",
    cachedReply: "**[{title}]** 장애 내용에 대한 분석 및 조치 가이드입니다.\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\n상세 터미널 로그 및 자동화 스크립트는 좌측의 **[CLI 트러블슈팅 실행]** 버튼을 클릭하여 확인하세요.",
    cliContent: "복구 파이프라인 및 터미널 엑세스를 통해 조치를 시작합니다.\n\n" + TBQ + "bash\n{cliMock}\n" + TBQ + "\n\n{insight}",
    cacheHit: "Last: 0 토큰 (Cache Hit - 비용 0원)",
    apiHit: "Last: {tokens} 토큰 (API 호출)",
    dailyTrend: "일별 사용 추이",
    monthlyTrend: "월별 사용 추이",
    dailyBtn: "일별",
    monthlyBtn: "월별",
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
    },
    apiSettingTitle: "Gemini API 설정",
    apiKeyPlaceholder: "API Key 입력...",
    saveBtn: "저장",
    apiKeyLinked: "API Key 연동 완료",
    resetBtn: "키 재설정",
    apiKeyMissingError: "API Key가 설정되지 않았습니다. 좌측 메뉴에서 API Key를 입력 후 저장해주세요.",
    apiKeyMissingAlert: "⚠️ 먼저 좌측 사이드바에 Gemini API Key를 입력 후 저장해주세요!",
    clearChat: "대화 초기화",
    speechNotSupported: "이 브라우저는 음성 인식을 지원하지 않습니다.",
    voiceMuteToggle: "음성 출력 토글",
    listening: "듣고 있습니다...",
    
    agentLogDump: "에러 로그 덤프 (Error Log Dump)",
    agentLogPlaceholder: "발생한 에러 로그, 알람 메시지를 붙여넣으세요...\n(예: xrdp_mm_process_login_response: login failed)",
    agentAnalyzing: "AI 원인 분석 중...",
    agentAnalyzeBtn: "분석 및 스크립트 생성",
    agentRootCause: "원인",
    agentResolution: "해결",
    agentAutoScript: "자동화 복구 스크립트",
    agentPreview: "예상되는 조치 사항 프리뷰",
    agentApproveReq: "스크립트를 대상 서버에 푸시하시겠습니까?",
    agentApproveDesc: "AWX Webhook 트리거를 통한 인프라 원격 복구 파이프라인",
    agentExecuteBtn: "원클릭 원격 복구 승인",
    agentExecuting: "인프라 복구 진행 중...",
    agentSuccess: "조치 성공 (정상화 완료)",
    backToChat: "채팅으로 돌아가기",
    adminMode: "관리자 권한 (Admin Mode)",
    unauthorizedBtn: "권한 없음 (Admin Only)",
    chatLabel: "채팅 (Chat)",
    agentLabel: "로그 분석 (Agent)",
    shellDownload: "Shell 다운로드",
    ansibleDownload: "Ansible 다운로드",
    transTitle: "번역",
    accessDenied: "접근 불가",
    unknownLogError: "알려지지 않은 에러 로그입니다. AI 동적 분석을 위해 사이드바에서 Gemini API Key를 설정해주세요.",
    apiRequestFailed: "API 요청에 실패했습니다.",
    aiAnalysisError: "AI 분석 중 오류가 발생했습니다:"
  },
  en: {
    title: "My IT Agent",
    subtitle: "Infra Troubleshooting",
    initMsg: "Hello. I am the Infra Troubleshooting AI Agent. Feel free to leave any questions in the chat.",
    urgencyBtn: "🚨 Critical Alert (Simulate)",
    agenticBtn: "🔎 Log Analysis Agent",
    agenticTitle: "Agentic Auto-Remediation Workflow",
    statsTitle: "KB Incident Stats",
    finopsTitle: "FinOps Token Monitor",
    totalUsage: "Total Usage",
    inputLabel: "Input",
    outputLabel: "Output",
    transKoLabel: "Korean (EN ➔ KO)",
    transEnLabel: "English (KO ➔ EN)",
    lastLabel: "Last:",
    actionReq: "Action Required",
    cliRun: "Run CLI Troubleshooting",
    ongoingTitle: "Ongoing Incidents",
    noOngoing: "No ongoing incidents at the moment.",
    sysAnal: "System Analysis",
    agent: "AI Agent",
    you: "You",
    catHelp: "Frequent Incident Categories",
    inputPlaceholder: "Describe incident symptoms or tech queries freely...",
    rcaGen: "Analyzing RCA & Generating Resolution...",
    simRcaMsg: "🚨 **[Critical Incident Detected & RCA Complete]**\nIncident: **{title}**\n\n<RCA>{rootCause}</RCA>\n\nPlease click the Run CLI Troubleshooting button to proceed with recovery.",
    cachedReply: "Here is the analysis and resolution guide for **[{title}]**.\n\n<RCA>{rootCause}</RCA>\n<RES>{resolution}</RES>\n\nPlease check the detailed terminal logs and automation scripts by clicking the **[Run CLI Troubleshooting]** button on the left.",
    cliContent: "Initiating recovery through the pipeline and terminal access.\n\n" + TBQ + "bash\n{cliMock}\n" + TBQ + "\n\n{insight}",
    cacheHit: "Last: 0 Tokens (Cache Hit - $0)",
    apiHit: "Last: {tokens} Tokens (API Call)",
    dailyTrend: "Daily Trend",
    monthlyTrend: "Monthly Trend",
    dailyBtn: "Daily",
    monthlyBtn: "Monthly",
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
    },
    apiSettingTitle: "Gemini API Settings",
    apiKeyPlaceholder: "Enter API Key...",
    saveBtn: "Save",
    apiKeyLinked: "API Key Linked",
    resetBtn: "Reset Key",
    apiKeyMissingError: "API Key is not set. Please enter and save your API Key in the left menu.",
    apiKeyMissingAlert: "⚠️ Please enter and save your Gemini API Key in the left sidebar first!",
    clearChat: "Clear Chat",
    speechNotSupported: "This browser does not support speech recognition.",
    voiceMuteToggle: "Toggle Voice Output",
    listening: "Listening...",
    
    agentLogDump: "Error Log Dump",
    agentLogPlaceholder: "Paste the error log or alert message here...\n(e.g., xrdp_mm_process_login_response: login failed)",
    agentAnalyzing: "AI Analyzing RCA...",
    agentAnalyzeBtn: "Analyze & Generate Script",
    agentRootCause: "RCA",
    agentResolution: "Fix",
    agentAutoScript: "Automation Recovery Script",
    agentPreview: "Action Preview",
    agentApproveReq: "Push script to target servers?",
    agentApproveDesc: "Remote recovery pipeline via AWX Webhook trigger",
    agentExecuteBtn: "Approve One-Click Recovery",
    agentExecuting: "Executing infrastructure recovery...",
    agentSuccess: "Remediation Successful",
    backToChat: "Back to Chat",
    adminMode: "Admin Privilege Mode",
    unauthorizedBtn: "Unauthorized (Admin Only)",
    chatLabel: "Chat",
    agentLabel: "Agent",
    shellDownload: "Download Shell",
    ansibleDownload: "Download Ansible",
    transTitle: "Translate",
    accessDenied: "Access Denied",
    unknownLogError: "Unknown error log. Please set the Gemini API Key in the sidebar for dynamic AI analysis.",
    apiRequestFailed: "API request failed.",
    aiAnalysisError: "An error occurred during AI analysis:"
  }
};

const parseMessageBlocks = (text) => {
  if (!text) return [];
  const blocks = [];
  const regex = new RegExp(`(<RCA>([\\s\\S]*?)<\\/RCA>|<RES>([\\s\\S]*?)<\\/RES>|${TBQ}(bash|sh|shell|yaml|yml|hcl|json)?\\n([\\s\\S]*?)${TBQ})`, "g");
  
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
    } else if (match[1].startsWith(TBQ)) {
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

const renderFormattedText = (text) => {
  if (!text) return null;
  const parts = text.split(new RegExp(`(\\*\\*.*?\\*\\*|${BQ}.*?${BQ})`, 'g'));
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="text-indigo-600 dark:text-indigo-400">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith(BQ) && part.endsWith(BQ)) {
      return <code key={index} className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
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

  return (
    <div className="mb-3 leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
      {renderFormattedText(displayed)}
    </div>
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
        {renderFormattedText(displayed)}
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
        {renderFormattedText(displayed)}
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

const TokenTrendChart = ({ history, lang, currentTokens }) => {
  const [chartView, setChartView] = useState('daily'); 
  const t = dict[lang];

  const getChartData = () => {
    const data = [];
    const today = new Date();

    if (chartView === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        let val = history[dateStr] || 0;
        if (i === 0 && currentTokens > 0) val += currentTokens;

        data.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          value: val,
          key: dateStr
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        data.push({
          label: lang === 'ko' ? `${d.getMonth() + 1}월` : d.toLocaleString('en-US', { month: 'short' }),
          value: 0,
          key: monthStr
        });
      }
      
      Object.keys(history).forEach(dateStr => {
        const mStr = dateStr.substring(0, 7);
        const target = data.find(m => m.key === mStr);
        if (target) target.value += history[dateStr];
      });

      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthTarget = data.find(m => m.key === currentMonthStr);
      if (currentMonthTarget && currentTokens > 0) {
        currentMonthTarget.value += currentTokens;
      }
    }
    return data;
  };

  const chartData = getChartData();
  const maxVal = Math.max(...chartData.map(d => d.value), 1000); 

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
          {chartView === 'daily' ? <CalendarDays className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
          {chartView === 'daily' ? t.dailyTrend : t.monthlyTrend}
        </span>
        <div className="flex gap-2 text-[9px] font-bold uppercase">
          <button 
            onClick={() => setChartView('daily')} 
            className={`transition-colors ${chartView === 'daily' ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            {t.dailyBtn}
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button 
            onClick={() => setChartView('monthly')} 
            className={`transition-colors ${chartView === 'monthly' ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            {t.monthlyBtn}
          </button>
        </div>
      </div>
      
      <div className="flex items-end justify-between h-16 gap-1 mt-4">
        {chartData.map((d, i) => {
          const heightPct = (d.value / maxVal) * 100;
          return (
            <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end">
               <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[9px] py-1 px-2 rounded font-bold transition-opacity whitespace-nowrap z-10 shadow-lg pointer-events-none">
                 {d.value.toLocaleString()}
                 <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-white rotate-45"></div>
               </div>
               <div className="w-full bg-slate-200 dark:bg-slate-800/50 rounded-t-sm flex items-end justify-center relative overflow-hidden" style={{ height: '100%' }}>
                 <div 
                   className="w-full bg-indigo-500/80 dark:bg-indigo-500 transition-all duration-700 rounded-t-sm group-hover:bg-indigo-400" 
                   style={{ height: `${Math.max(heightPct, 2)}%` }}
                 ></div>
               </div>
               <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState('ko');
  const [theme, setTheme] = useState('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // === [통합] 뷰 상태 및 에이전트 상태 ===
  const [activeView, setActiveView] = useState('chat');
  const [logInput, setLogInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [matchedSolution, setMatchedSolution] = useState(null);
  const [executionStatus, setExecutionStatus] = useState('idle');
  
  // === [신규 추가] 관리자 권한 상태 (RBAC 모의) ===
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('USER'); // 'USER' | 'ADMIN'

  // 🛡️ [CRITICAL - 언어 동기화 로직 추가] 
  useEffect(() => {
    setMatchedSolution(prev => {
      if (!prev) return null;
      return kbData[lang].find(item => item.id === prev.id) || prev;
    });
  }, [lang]);
    
  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);
  
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('chat_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map(m => ({ ...m, isNew: false })); 
        } catch (e) {
          console.error("Session storage parsing error", e);
        }
      }
    }
    return [];
  });
  
  useEffect(() => {
    if (messages.length === 0) setMessages([{ id: 'init-1', role: 'assistant', type: 'INIT', isNew: false }]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.map(m => ({ ...m, isNew: false }));
      sessionStorage.setItem('chat_history', JSON.stringify(toSave));
    }
  }, [messages]);

  const [tokenHistory, setTokenHistory] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('token_history');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return {};
  });

  const markMessageAsOld = useCallback((id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isNew: false } : m));
  }, []);

  const updateTokenHistory = useCallback((newTokens) => {
    if (newTokens <= 0) return;
    const today = new Date().toISOString().split('T')[0]; 
    setTokenHistory(prev => {
      const updated = { ...prev, [today]: (prev[today] || 0) + newTokens };
      localStorage.setItem('token_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [activeCLIAction, setActiveCLIAction] = useState(null); 
  
  // 🛡️ [수정됨] FinOps 토큰 관리 고도화 (채팅과 에이전트 토큰 분리)
  const [tokens, setTokens] = useState({ 
    input: 0, 
    output: 0, 
    transKo: 0, 
    transEn: 0, 
    chat: 0, 
    agent: 0, 
    total: 0, 
    type: 'NONE', 
    count: 0 
  });
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  
  const currentInputRef = useRef(''); 
  const recognitionRef = useRef(null); 
  const handleSendMessageRef = useRef(null); 
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  
  const t = dict[lang];

  const wakeUpSpeechEngine = () => {
    try {
      if ('speechSynthesis' in window) {
        const wakeUpUtterance = new SpeechSynthesisUtterance('');
        wakeUpUtterance.volume = 0; 
        window.speechSynthesis.speak(wakeUpUtterance);
      }
    } catch (e) {}
  };

  const speakText = useCallback((textToSpeak) => {
    if (isAudioMuted) return;
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.resume(); 
      window.speechSynthesis.cancel();
      
      const codeBlockRegex = new RegExp(`${TBQ}[\\s\\S]*?${TBQ}`, 'g');
      const htmlTagRegex = new RegExp('<[^>]+>', 'g');
      const boldRegex = new RegExp('\\*\\*(.*?)\\*\\*', 'g');
      const backtickRegex = new RegExp(BQ, 'g');
      
      let cleanText = textToSpeak
        .replace(codeBlockRegex, lang === 'ko' ? ' 상세 스크립트는 화면의 코드 블록을 참고해 주세요. ' : ' Please refer to the code block on the screen. ')
        .replace(htmlTagRegex, '')
        .replace(boldRegex, '$1')
        .replace(backtickRegex, '');
        
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
      utterance.rate = 1.1; 
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Safe Mode: TTS bypassed error", err);
    }
  }, [isAudioMuted, lang]);

  const toggleListening = () => {
    try {
      wakeUpSpeechEngine();

      if (isListening) {
        setIsListening(false);
        const textToSend = currentInputRef.current;
        
        if (recognitionRef.current) {
          recognitionRef.current.onresult = null; 
          recognitionRef.current.stop();
        }
        
        if (textToSend.trim() && handleSendMessageRef.current) {
          handleSendMessageRef.current(textToSend);
        }
        return;
      }

      setIsAudioMuted(false); 

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert(t.speechNotSupported);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition; 
      recognition.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
      recognition.continuous = true; 
      recognition.interimResults = true; 
      recognition.maxAlternatives = 1;

      const baseInput = currentInputRef.current ? currentInputRef.current + ' ' : '';

      recognition.onstart = () => setIsListening(true);
      
      recognition.onresult = (event) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          sessionTranscript += event.results[i][0].transcript;
        }
        const newVal = baseInput + sessionTranscript;
        currentInputRef.current = newVal;
        setInput(newVal); 
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition bypassed error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (error) {
      console.warn('Speech API blocked by browser security.', error);
      alert("브라우저 보안 정책으로 인해 마이크 접근이 차단되었습니다.");
      setIsListening(false);
    }
  };

  const categoryCounts = kbData[lang].reduce((acc, curr) => {
    const localizedCatName = t.categories[curr.category] || curr.category;
    acc[localizedCatName] = (acc[localizedCatName] || 0) + 1;
    return acc;
  }, {});
  const maxCategoryCount = Math.max(...Object.values(categoryCounts));

  const fetchGemini = async (payload) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTokens = tokenHistory[todayStr] || 0;
    if (todayTokens > 50000) throw new Error("오늘의 API 무료 사용량 한도(50,000 Token)를 초과했습니다. 관리자에게 문의하세요.");

    const url = `\api\gemini.js`;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json',
            
          }, 
          body: JSON.stringify(payload) 
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 503) { await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt))); continue; }
          throw new Error(t.apiRequestFailed);
        }
        return await response.json();
      } catch (err) { if (attempt === 2) throw err; }
    }
    throw new Error("API 타임아웃: 서버가 응답하지 않거나 트래픽이 초과되었습니다.");
  };

  const translateMessage = async (text, targetLang, msgId) => {
    const prompt = `Translate the following IT/infrastructure text to ${targetLang === 'ko' ? 'Korean' : 'English'}. Keep IT terminologies (like EKS, OOMKilled, Nginx, WAS) in English if appropriate. Return ONLY the translated text.\n\nText: ${text}`;
    try {
      const res = await fetchGemini({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "You are an expert IT translator. Provide direct translation without any markdown wrapping or conversational fillers." }] }
      });
      const translatedText = res?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (translatedText) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: { ...m.content, [targetLang]: translatedText.trim() } } : m));
        if (res.usageMetadata && res.usageMetadata.totalTokenCount) {
           setTokens(prev => ({ 
             ...prev, 
             total: prev.total + res.usageMetadata.totalTokenCount,
             transKo: targetLang === 'ko' ? prev.transKo + res.usageMetadata.totalTokenCount : prev.transKo,
             transEn: targetLang === 'en' ? prev.transEn + res.usageMetadata.totalTokenCount : prev.transEn,
             chat: prev.chat + res.usageMetadata.totalTokenCount // 번역은 채팅의 부가기능으로 Chat 토큰에 포함
           }));
           updateTokenHistory(res.usageMetadata.totalTokenCount); 
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
    return matches.map(m => `ID: ${m.id}\nTitle: ${m.title}\nRoot Cause: ${m.rootCause}\nResolution: ${m.resolution}\nCLI Mock: ${m.insight}`).join('\n\n');
  };

  const handleCategoryClick = (localizedCatName) => {
    wakeUpSpeechEngine();

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
      
      if (!isAudioMuted) {
        const textToSpeak = t.cachedReply.replace('{title}', item.title).replace('{rootCause}', item.rootCause).replace('{resolution}', item.resolution);
        speakText(textToSpeak);
      }
    }, 400);
  };

  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isLoading) return;

    wakeUpSpeechEngine();

    setInput('');
    currentInputRef.current = ''; 
    const userMsgId = Date.now().toString() + "-u";
    setMessages(prev => [...prev, { 
      id: userMsgId, role: 'user', type: 'CUSTOM_CHAT', 
      content: { ko: null, en: null, [lang]: userText }, 
      originalLang: lang, isNew: false 
    }]);
    setIsLoading(true);

    const targetLang = lang === 'ko' ? 'en' : 'ko';
    
    await translateMessage(userText, targetLang, userMsgId);

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
- 터미널 커맨드, 로그, 자동화 스크립트(Terraform, Ansible 등)가 필요하다면 반드시 마크다운 코드 블록(${TBQ}bash, ${TBQ}yaml 등)을 사용하여 직접 작성해 제공하세요.
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
    
    contents.push({ role: 'user', parts: [{ text: `<<<USER_INPUT_START>>>\n${userText}\n<<<USER_INPUT_END>>>` }] });

    try {
      const result = await fetchGemini({ contents, systemInstruction: { parts: [{ text: systemInstruction }] } });
      let reply = result?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
      
      const matchIdRegex = /\[MATCHED_KB_ID:\s*([A-Z0-9-]+)\]/i;
      const match = reply.match(matchIdRegex);
      let matchedId = null;
      
      if (match) {
        matchedId = match[1];
        reply = reply.replace(matchIdRegex, '').trim(); 
      }

      if (result.usageMetadata && result.usageMetadata.totalTokenCount) {
        setTokens(prev => ({
          ...prev,
          input: prev.input + result.usageMetadata.promptTokenCount,
          output: prev.output + result.usageMetadata.candidatesTokenCount,
          total: prev.total + result.usageMetadata.totalTokenCount,
          chat: prev.chat + result.usageMetadata.totalTokenCount, // 🛡️ 채팅 토큰 누적
          type: 'API',
          count: result.usageMetadata.totalTokenCount
        }));
        updateTokenHistory(result.usageMetadata.totalTokenCount); 
      }

      const aiMsgId = Date.now().toString() + "-a";
      setMessages(prev => [...prev, { 
        id: aiMsgId, role: 'assistant', type: 'CUSTOM_CHAT', 
        content: { ko: null, en: null, [lang]: reply }, 
        originalLang: lang, isNew: true 
      }]);
      
      translateMessage(reply, targetLang, aiMsgId);

      speakText(reply);

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

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);

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
      
      if (!isAudioMuted) {
        const textToSpeak = t.simRcaMsg.replace('{title}', targetCase.title).replace('{rootCause}', targetCase.rootCause);
        speakText(textToSpeak);
      }
    }, 5000);
  };

  const handleCLIAction = (actionId) => {
    setActiveCLIAction(null); 
    const cliMsgId = Date.now().toString() + "-cli";
    setMessages(prev => [...prev, { id: cliMsgId, role: 'assistant', type: 'CLI_ACTION', caseId: actionId, isNew: true }]);
    setActiveIncidents([]); 
    setIsSimulating(false);
  };

  const handleClearChat = () => {
    setMessages([{ id: Date.now().toString() + "-init", role: 'assistant', type: 'INIT', isNew: false }]);
    setActiveCLIAction(null);
    setLogInput('');
    setMatchedSolution(null);
    setExecutionStatus('idle');
    try { if(window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e) {}
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

  // === [신규 기능] 에이전트 로그 분석 로직 (API 연동) ===
  const handleAnalyzeLog = useCallback(async () => {
    if (!logInput || !logInput.trim()) return;
    setAnalyzing(true);
    setMatchedSolution(null);
    setExecutionStatus('idle');

    const lowerLog = logInput.toLowerCase();
    let found = null;
    
    // 1. 알려진 에러 로그는 KB에서 즉시 매칭 (비용 0)
    if (lowerLog.includes('vsftpd') || lowerLog.includes('ftp') || lowerLog.includes('500 oops')) {
      found = kbData[lang][1];
    } else if (lowerLog.includes('space') || lowerLog.includes('tomcat')) {
      found = kbData[lang][2];
    } else if (lowerLog.includes('x509') || lowerLog.includes('connection refused')) {
      found = kbData[lang][3];
    } else if (lowerLog.includes('terraform') || lowerLog.includes('ncloud')) {
      found = kbData[lang][4];
    } else if (lowerLog.includes('mariadb') || lowerLog.includes('binlog')) {
      found = kbData[lang][5];
    }

    if (found) {
      setTimeout(() => {
        setMatchedSolution(found);
        setAnalyzing(false);
      }, 1000);
      return;
    }

    // 2. KB에 없는 알 수 없는 에러 로그는 Gemini API 동적 호출
    
    const systemInstruction = `당신은 클라우드/인프라 최고 등급(L3) 장애 해결 에이전트입니다.
제공된 에러 로그를 분석하여 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 추가하지 마세요.
{
  "id": "TS-DYNAMIC-AI",
  "title": "로그의 핵심을 요약한 장애 제목",
  "rootCause": "장애가 발생한 근본 원인 상세 분석",
  "resolution": "장애를 해결하기 위한 단계별 조치 방안",
  "cliMock": "터미널에서 직접 실행할 수 있는 Bash 명령어들 (각 라인은 $ 로 시작할 것. 마크다운 백틱 사용 금지)",
  "insight": "이 문제를 자동화하기 위한 Ansible Playbook. 반드시 코드 블록 형태(${TBQ}yaml ... ${TBQ})로 작성할 것."
}`;

    try {
      const response = await fetch(`/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `언어: ${lang === 'ko' ? '한국어' : 'English'}\n\nError Log:\n${logInput}` }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error(t.apiRequestFailed);
      const result = await response.json();
      const replyText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (replyText) {
        const dynamicSolution = JSON.parse(replyText);
        setMatchedSolution(dynamicSolution);

        if (result.usageMetadata && result.usageMetadata.totalTokenCount) {
          const usedTokens = result.usageMetadata.totalTokenCount;
          setTokens(prev => ({ 
            ...prev, 
            input: prev.input + result.usageMetadata.promptTokenCount, 
            output: prev.output + result.usageMetadata.candidatesTokenCount, 
            total: prev.total + usedTokens, 
            agent: prev.agent + usedTokens, // 🛡️ 에이전트 토큰 누적
            type: 'API', 
            count: usedTokens 
          }));
          const today = new Date().toISOString().split('T')[0];
          setTokenHistory(prev => {
            const updated = { ...prev, [today]: (prev[today] || 0) + usedTokens };
            localStorage.setItem('token_history', JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (error) {
      alert(`${t.aiAnalysisError}\n${error.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [logInput, lang, t]);

  // === [신규 기능] 파일 다운로드 유틸리티 (XSS 방어) ===
  const downloadFile = useCallback((filename, content) => {
    try {
      const element = document.createElement("a");
      const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const fileURL = URL.createObjectURL(file);
      element.href = fileURL;
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(fileURL); 
    } catch (error) {
      console.error("다운로드 에러:", error);
    }
  }, []);

  const handleDownloadAnsible = useCallback((solution) => {
    if (!solution || !solution.insight) return;
    let content = `# Ansible Playbook\n# Parsing failed.`;
    if (solution.insight.includes(TBQ + 'yaml')) {
      const parts = solution.insight.split(TBQ + 'yaml');
      if (parts.length > 1) {
        content = parts[1].split(TBQ)[0].trim();
      }
    }
    downloadFile(`fix_${solution.id}.yml`, content);
  }, [downloadFile]);

  const handleDownloadShell = useCallback((solution) => {
    if (!solution) return;
    let content = "#!/bin/bash\n\n";
    if (solution.insight && solution.insight.includes(TBQ + 'bash')) {
      const parts = solution.insight.split(TBQ + 'bash');
      if (parts.length > 1) {
        content += parts[1].split(TBQ)[0].trim();
        downloadFile(`fix_${solution.id}.sh`, content);
        return;
      }
    }
    if (solution.cliMock) {
      solution.cliMock.split('\n').forEach(line => {
        if (line && (line.trim().startsWith('$') || line.trim().startsWith('`$'))) {
          content += line.replace(/^`?\$\s*/, '') + "\n";
        }
      });
    }
    downloadFile(`fix_${solution.id}.sh`, content.trim());
  }, [downloadFile]);

  return (
    <div className="h-screen flex flex-col md:flex-row font-sans overflow-hidden bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 transition-colors duration-300">
      
      <div className="absolute top-4 right-4 z-50 space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all animate-in slide-in-from-right-8 ${toast.color}`}>
            {toast.icon}
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{toast.msg}</span>
          </div>
        ))}
      </div>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

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

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col gap-2">
          <button 
            onClick={triggerSelectedSimulation}
            disabled={isSimulating}
            className="w-full bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all group shadow-sm"
          >
            <BellRing className={`w-4 h-4 ${!isSimulating && 'group-hover:animate-wiggle'}`} /> {t.urgencyBtn}
          </button>
          
          <button 
            onClick={() => { setActiveView('agentic'); setIsMobileMenuOpen(false); }}
            className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm
              ${activeView === 'agentic' 
                ? 'bg-indigo-600 text-white border border-indigo-500' 
                : 'bg-white hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }
            `}
          >
            <Search className="w-4 h-4" /> {t.agenticBtn}
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          <div className="mb-6 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 p-4 rounded-xl">
             <div className="flex items-center justify-between mb-2">
               <h2 className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" /> {t.apiSettingTitle}
               </h2>
             </div>
            
             {/* 🛡️ [수정됨] 관리자 권한 (RBAC) 토글 - ADMIN이 아니면 아예 숨김 처리 */}
             {userRole === 'ADMIN' && (
               <div className="mt-3 flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg shadow-sm animate-in fade-in zoom-in duration-200">
                 <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                   <ShieldAlert className="w-3.5 h-3.5" /> {t.adminMode}
                 </span>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" className="sr-only peer" checked={isAdmin} onChange={() => setIsAdmin(!isAdmin)} />
                   <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                 </label>
               </div>
             )}
          </div>

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
          
          {/* 🛡️ [수정됨] FinOps 대시보드 - 프로그레스 바 고도화 및 정렬 수정 */}
          <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner mb-6">
            <div className="text-center mb-4 pb-4 border-b border-slate-200 dark:border-slate-800/50 relative">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1 font-bold">{t.totalUsage}</span>
              <div className="text-3xl font-light text-slate-900 dark:text-white flex justify-center items-baseline gap-1">
                {tokens.total.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold mb-1">{"/ 50K"}</span>
              </div>
            </div>

            {/* 🛡️ FinOps: 채팅 vs 로그분석 게이지 바 */}
            <div className="space-y-3.5 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800/50">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><MessageSquare className="w-3 h-3"/> {t.chatLabel}</span>
                  <span className="text-slate-700 dark:text-slate-300">{tokens.chat.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((tokens.chat / 50000) * 100, 100)}%` }}></div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Search className="w-3 h-3"/> {t.agentLabel}</span>
                  <span className="text-slate-700 dark:text-slate-300">{tokens.agent.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((tokens.agent / 50000) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>

            {/* 상세 내역 요약 그리드 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 block mb-1 font-bold leading-tight">
                  {t.inputLabel} {"/"} <br />{t.outputLabel}
                </span>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-auto">
                  <span className="text-indigo-500">{tokens.input}</span> <span className="text-slate-400 font-normal">{"/"}</span> <span className="text-teal-500">{tokens.output}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 block mb-1 font-bold flex items-center gap-1 leading-tight"><Globe className="w-2.5 h-2.5 shrink-0"/>{t.transTitle}<br />{"(KO/EN)"}</span>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-auto">
                  <span className="text-orange-500">{tokens.transKo}</span> <span className="text-slate-400 font-normal">{"/"}</span> <span className="text-orange-500">{tokens.transEn}</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 text-center font-bold text-green-600 dark:text-green-400 mb-2">
               {getLatestTokenStr()}
            </div>
            
            <TokenTrendChart history={tokenHistory} lang={lang} currentTokens={tokens.total} />
          </div>

          {activeCLIAction && activeView === 'chat' && (
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

      <main className="flex-1 flex flex-col h-full relative bg-slate-50 dark:bg-[#0B1120]">
        <header className="h-14 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex justify-between md:justify-end items-center px-4 md:px-6 z-20 shrink-0 gap-4 transition-colors duration-300">
           
           <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white">
             <Menu className="w-6 h-6" />
           </button>

           <div className="flex items-center gap-4">
             <button 
               onClick={() => {
                 try { if (!isAudioMuted && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
                 setIsAudioMuted(!isAudioMuted);
               }}
               title={t.voiceMuteToggle}
               className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors text-sm border border-slate-300 dark:border-slate-700 shadow-sm"
             >
               {isAudioMuted ? '🔇' : '🔊'}
             </button>

             {/* 권한 스위치 (이스트에그 형태의 관리자 진입점 - 툴팁 완전 제거) */}
             <button 
               onClick={() => setUserRole(prev => prev === 'ADMIN' ? 'USER' : 'ADMIN')}
               className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors text-sm border shadow-sm ${userRole === 'ADMIN' ? 'bg-emerald-100 border-emerald-300 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400' : 'bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}
             >
               <User className="w-4 h-4" />
             </button>

             <button 
               onClick={handleClearChat}
               title={t.clearChat}
               className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors"
             >
               <Trash2 className="w-5 h-5" />
             </button>

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

        {activeView === 'chat' && (
          <>
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
                
                {activeCLIAction && <div className="h-16 md:hidden"></div>}
              </div>
            </div>

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
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isLoading}
                    title={isListening ? "클릭 시 음성 입력 종료 및 질문 전송" : "클릭 시 음성 질문 시작"}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all text-[16px] shadow-sm ${
                      isListening 
                        ? 'bg-red-100 dark:bg-red-500/20 grayscale-0 animate-pulse border border-red-300 dark:border-red-500/50' 
                        : 'grayscale opacity-70 hover:opacity-100 hover:grayscale-0 bg-transparent'
                    }`}
                  >
                    {isListening ? '🔴' : '🎤'}
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      currentInputRef.current = e.target.value; 
                    }}
                    maxLength={500} 
                    placeholder={isListening ? t.listening : t.inputPlaceholder}
                    className={`w-full bg-slate-100 dark:bg-slate-900 border ${isListening ? 'border-red-400 dark:border-red-500/50' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white font-medium rounded-full pl-14 pr-14 py-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner`}
                    disabled={isLoading || isListening}
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
          </>
        )}

        {/* 🛡️ [수정됨] 에이전트 뷰: 가로 스크롤 잘림 문제 해결 */}
        {activeView === 'agentic' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar scroll-smooth animate-in slide-in-from-right-8 duration-300">
            <div className="max-w-4xl mx-auto space-y-6 pb-4">
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30">
                    <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.agenticTitle}</h2>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveView('chat')}
                  className="flex items-center space-x-1.5 text-sm font-medium px-4 py-2 rounded-lg border transition-colors shadow-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700"
                >
                  <MessageSquare className="w-4 h-4" /> <span className="hidden sm:inline">{t.backToChat}</span>
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md">
                <label className="block text-sm font-bold mb-3 flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>{t.agentLogDump}</span>
                </label>
                <textarea
                  value={logInput}
                  onChange={(e) => setLogInput(e.target.value)}
                  placeholder={t.agentLogPlaceholder}
                  className="w-full h-40 p-4 font-mono text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none shadow-inner bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300"
                />
                <div className="mt-5 flex justify-end">
                  <button 
                    onClick={handleAnalyzeLog}
                    disabled={!logInput || !logInput.trim() || analyzing}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md active:scale-95"
                  >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    <span>{analyzing ? t.agentAnalyzing : t.agentAnalyzeBtn}</span>
                  </button>
                </div>
              </div>

              {matchedSolution && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 overflow-x-auto custom-scrollbar shadow-xl animate-in fade-in duration-500">
                  <div className="min-w-[600px] md:min-w-full">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 border-b border-indigo-100 dark:border-indigo-500/20 p-6 flex items-start space-x-4">
                      <ShieldAlert className="w-7 h-7 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white break-words">{matchedSolution.title}</h3>
                        <div className="mt-4 space-y-3">
                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">
                            <span className="font-bold px-2 py-1 rounded mr-2 border text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-700/50 inline-block mb-1">{t.agentRootCause}</span> 
                            {matchedSolution.rootCause}
                          </p>
                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap">
                            <span className="font-bold px-2 py-1 rounded mr-2 border text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700/50 inline-block mb-1">{t.agentResolution}</span> 
                            {matchedSolution.resolution}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-500 flex items-center space-x-2 shrink-0">
                          <Server className="w-5 h-5"/> <span>{t.agentAutoScript}</span>
                        </span>
                        <div className="flex space-x-3 shrink-0">
                          <button 
                            onClick={() => handleDownloadShell(matchedSolution)}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 text-xs border px-4 py-2.5 rounded-lg font-bold shadow-sm transition-colors bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white"
                          >
                            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" /> <span>{t.shellDownload}</span>
                          </button>
                          <button 
                            onClick={() => handleDownloadAnsible(matchedSolution)}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 text-xs border px-4 py-2.5 rounded-lg font-bold shadow-sm transition-colors bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white"
                          >
                            <FileCode className="w-4 h-4 text-amber-600 dark:text-amber-400" /> <span>{t.ansibleDownload}</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-[#0f172a] p-5 rounded-xl border border-slate-800 text-white font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed mb-6 shadow-inner">
                        <div className="text-slate-500 mb-3 select-none"># {t.agentPreview}</div>
                        {matchedSolution.cliMock && matchedSolution.cliMock.split('\n').map((line, i) => (
                          <div key={i} className={
                            line.startsWith('[ERROR]') ? 'text-red-400 font-bold' : 
                            line.startsWith('[SUCCESS]') || line.startsWith('[INFO]') ? 'text-emerald-400 font-bold' : 
                            line.startsWith('$') || line.startsWith('`$') ? 'text-blue-300' : 
                            'text-slate-300'
                          }>
                            {line}
                          </div>
                        ))}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center shadow-inner">
                        <p className="text-base font-bold mb-2 text-slate-800 dark:text-white">{t.agentApproveReq}</p>
                        <p className="text-sm mb-6 text-slate-500 dark:text-slate-400">{t.agentApproveDesc}</p>
                        
                        {/* 🛡️ [수정됨] 권한(userRole) 및 토글(isAdmin) 체크 로직 적용 */}
                        {executionStatus === 'idle' && (
                          <button 
                            onClick={() => { setExecutionStatus('running'); setTimeout(() => setExecutionStatus('success'), 2500); }}
                            disabled={userRole !== 'ADMIN' || !isAdmin}
                            className={`w-full md:w-auto mx-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-xl font-bold transition-all
                              ${userRole === 'ADMIN' && isAdmin 
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95' 
                                : 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed'
                              }
                            `}
                          >
                            {userRole === 'ADMIN' && isAdmin ? <PlayCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                            <span>{userRole === 'ADMIN' && isAdmin ? t.agentExecuteBtn : t.unauthorizedBtn}</span>
                          </button>
                        )}
                        
                        {executionStatus === 'running' && (
                          <div className="w-full md:w-auto mx-auto flex items-center justify-center space-x-3 text-emerald-600 dark:text-emerald-400 px-8 py-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="font-bold">{t.agentExecuting}</span>
                          </div>
                        )}

                        {executionStatus === 'success' && (
                          <div className="w-full md:w-auto mx-auto flex items-center justify-center space-x-2 text-emerald-800 dark:text-emerald-100 px-8 py-4 bg-emerald-100 dark:bg-emerald-600 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-500 animate-in zoom-in-95">
                            <CheckCircle className="w-6 h-6" />
                            <span className="font-bold text-lg">{t.agentSuccess}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .dark .custom-scrollbar {
          scrollbar-color: #334155 transparent;
        }
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
