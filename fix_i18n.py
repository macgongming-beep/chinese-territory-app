with open('src/i18n.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "'settings.notificationTitle': '푸시 알림',",
    "'settings.notificationTitle': '푸시 알림',\n    'settings.locationTitle': '위치 권한 설정',\n    'settings.locationDesc': '지도 기반 서비스 위치 동의',"
)
content = content.replace(
    "'settings.notificationTitle': '推送通知',",
    "'settings.notificationTitle': '推送通知',\n    'settings.locationTitle': '位置权限设置',\n    'settings.locationDesc': '基于地图的服务位置同意',"
)
content = content.replace(
    "'settings.notificationTitle': 'Push Notifications',",
    "'settings.notificationTitle': 'Push Notifications',\n    'settings.locationTitle': 'Location Settings',\n    'settings.locationDesc': 'Location consent for map services',"
)

with open('src/i18n.ts', 'w') as f:
    f.write(content)
