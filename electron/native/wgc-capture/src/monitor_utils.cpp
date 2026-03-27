#include "monitor_utils.h"
#include <ShellScalingApi.h>
#include <iostream>

static BOOL CALLBACK enumMonitorCallback(HMONITOR hMonitor, HDC, LPRECT, LPARAM lParam) {
    auto* monitors = reinterpret_cast<std::vector<MonitorInfo>*>(lParam);

    MONITORINFOEXW mi = {};
    mi.cbSize = sizeof(mi);
    if (GetMonitorInfoW(hMonitor, &mi)) {
        MonitorInfo info;
        info.handle = hMonitor;
        info.x = mi.rcMonitor.left;
        info.y = mi.rcMonitor.top;
        info.width = mi.rcMonitor.right - mi.rcMonitor.left;
        info.height = mi.rcMonitor.bottom - mi.rcMonitor.top;
        info.deviceName = mi.szDevice;
        monitors->push_back(info);
    }

    return TRUE;
}

std::vector<MonitorInfo> enumerateMonitors() {
    std::vector<MonitorInfo> monitors;
    EnumDisplayMonitors(nullptr, nullptr, enumMonitorCallback, reinterpret_cast<LPARAM>(&monitors));
    return monitors;
}

static std::string wstringToString(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string str(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), (int)wstr.size(), &str[0], size_needed, NULL, NULL);
    return str;
}

// Electron uses the HMONITOR handle value cast to a number as the display ID.
HMONITOR findMonitorByDisplayId(int64_t displayId) {
    auto monitors = enumerateMonitors();

    // Try exact match first
    for (const auto& m : monitors) {
        if (static_cast<int64_t>(reinterpret_cast<intptr_t>(m.handle)) == displayId) {
            return m.handle;
        }
    }

    // Try matching lower 32-bits (HMONITOR handles on Windows are often 32-bit values zero-extended or sign-extended to 64-bit)
    for (const auto& m : monitors) {
        if ((static_cast<int64_t>(reinterpret_cast<intptr_t>(m.handle)) & 0xFFFFFFFF) == (displayId & 0xFFFFFFFF)) {
            std::cerr << "WARNING: Found monitor via 32-bit partial match. Target: " << displayId 
                      << ", Found: " << static_cast<int64_t>(reinterpret_cast<intptr_t>(m.handle)) << std::endl;
            return m.handle;
        }
    }

    // If we only have one monitor and we couldn't match by ID, just use the only one we have.
    // This is a safe fallback for the most common case (single monitor setups) where Electron
    // and native Windows might report different IDs for the same display.
    if (monitors.size() == 1) {
        std::cerr << "WARNING: Found only one monitor, using it as fallback for displayId " << displayId 
                  << " (Handle: " << reinterpret_cast<intptr_t>(monitors[0].handle) << ")" << std::endl;
        return monitors[0].handle;
    }

    // Debug: Print available monitors if not found
    std::cerr << "ERROR: Monitor matching failed for displayId " << displayId << ". Enumerated " << monitors.size() << " monitors:" << std::endl;
    for (const auto& m : monitors) {
        std::cerr << "  - Handle: " << reinterpret_cast<intptr_t>(m.handle)
                  << " (device: " << wstringToString(m.deviceName) 
                  << ", bounds: " << m.x << "," << m.y << " " << m.width << "x" << m.height << ")" << std::endl;
    }

    return nullptr;
}

HMONITOR findMonitorByBounds(int x, int y, int width, int height) {
    auto monitors = enumerateMonitors();

    // 1. Try exact bounds match
    for (const auto& m : monitors) {
        if (m.x == x && m.y == y && m.width == width && m.height == height) {
            std::cerr << "Found monitor by exact bounds: " << x << "," << y << " " << width << "x" << height << std::endl;
            return m.handle;
        }
    }

    // 2. Try matching top-left point (sometimes size differs due to DPI scaling, but top-left is usually more stable in screen-space)
    for (const auto& m : monitors) {
        if (m.x == x && m.y == y) {
            std::cerr << "Found monitor by top-left point match: " << x << "," << y << std::endl;
            return m.handle;
        }
    }

    // 3. Last resort: MonitorFromRect/Point (OS choice for the best matching monitor for these coordinates)
    RECT rect = { x, y, x + width, y + height };
    HMONITOR hMonitor = MonitorFromRect(&rect, MONITOR_DEFAULTTONULL);
    if (hMonitor) {
        std::cerr << "Found monitor via Windows OS MonitorFromRect fallback" << std::endl;
        return hMonitor;
    }

    return nullptr;
}

MonitorInfo getMonitorInfo(HMONITOR monitor) {
    MonitorInfo info;
    info.handle = monitor;

    MONITORINFOEXW mi = {};
    mi.cbSize = sizeof(mi);
    if (GetMonitorInfoW(monitor, &mi)) {
        info.x = mi.rcMonitor.left;
        info.y = mi.rcMonitor.top;
        info.width = mi.rcMonitor.right - mi.rcMonitor.left;
        info.height = mi.rcMonitor.bottom - mi.rcMonitor.top;
        info.deviceName = mi.szDevice;
    }

    return info;
}
