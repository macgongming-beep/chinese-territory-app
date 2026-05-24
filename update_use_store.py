with open('src/hooks/useStore.ts', 'r') as f:
    content = f.read()

content = content.replace(
    "const [restaurantRequests, setRestaurantRequests] = useState<RestaurantRequest[]>([])",
    "const [restaurantRequests, setRestaurantRequests] = useState<RestaurantRequest[]>([])\n  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({})"
)

content = content.replace(
    "supabase.from('restaurant_requests').select('*').order('requested_at', { ascending: false }),",
    "supabase.from('restaurant_requests').select('*').order('requested_at', { ascending: false }),\n      supabase.from('app_settings').select('*'),"
)

content = content.replace(
    "informalGroupsRes, restaurantRequestsRes,",
    "informalGroupsRes, restaurantRequestsRes, settingsRes,"
)

content = content.replace(
    "setRestaurantRequests(restaurantRequestsRes.error ? [] : (restaurantRequestsRes.data as RawRestaurantRequest[]).map(toRestaurantRequest))",
    "setRestaurantRequests(restaurantRequestsRes.error ? [] : (restaurantRequestsRes.data as RawRestaurantRequest[]).map(toRestaurantRequest))\n    setGlobalSettings(settingsRes.error ? {} : Object.fromEntries((settingsRes.data as { key: string; value: string }[]).map(r => [r.key, r.value])))"
)

content = content.replace(
    "// 식당봉사",
    "globalSettings,\n    // 식당봉사"
)

with open('src/hooks/useStore.ts', 'w') as f:
    f.write(content)
