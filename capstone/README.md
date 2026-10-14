# Design and Simulation of an Intelligent IoT-Based Smart Office Network and Energy Optimization System

**Degree:** BE Computer Science Engineering  
**Module:** IoT Sensor Integration and System Architecture Implementation  
**Student Name:** Tenzin Wangchu Khongsai  
**Register Number:** 192511447  
**Team Number:** 10  
**Project Record:** 24  

---

## 🏢 Project Overview

This application is a **Digital Smart Office Simulation Platform** created as part of a BE Computer Science Engineering project. It simulates an intelligent smart office environment featuring virtual IoT sensors, automated device control, energy optimization, real-time monitoring, and visual analytics.

> **Note:** This project is a **software-based IoT simulation**. No physical IoT hardware (sensors, physical relays, or lights) is required. The software fully simulates the environmental dynamics, sensor measurements, automation logic, and device operations.

---

## 💡 Core Philosophy

The system operates around the four-stage conceptual flow:

$$\text{SENSE} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{RESPOND} \longrightarrow \text{SAVE}$$

1. **SENSE:** Virtual sensors monitor environmental variables in real time:
   - **Occupancy Sensor:** Detects presence (Detected / Not Detected).
   - **Temperature Sensor:** Monitors ambient room temperature (°C).
   - **Light Sensor:** Measures natural/ambient lighting level (0–100%).
   - **Energy Sensor:** Tracks real-time room power consumption (kW).
2. **UNDERSTAND:** The backend server aggregates sensor readings, analyzes room state, and determines environmental requirements.
3. **RESPOND:** The rule-based automation engine evaluates conditions and automatically controls virtual devices (Lights, Fans, Cooling Units).
4. **SAVE:** The energy engine calculates baseline vs. automated energy usage, demonstrating quantifiable energy savings (e.g. 14%+ simulated savings).

---

## 🏗️ 7-Layer System Architecture

| Layer | Name | Description |
|-------|------|-------------|
| **L1** | Virtual Environment | Spatial definition of 20 office rooms across 2 floors with distinct room types. |
| **L2** | Virtual Sensors | Software sensors generating real-time occupancy, temperature, light, and power readings. |
| **L3** | Data Collection | SQLite database storage and Socket.IO real-time data streaming. |
| **L4** | Central Processing | Node.js + Express backend coordinating data ingestion, state management, and events. |
| **L5** | Decision & Automation | Rule-based automation engine evaluating conditions and executing device actions. |
| **L6** | Virtual Devices | Simulated actuators (100W Lights, 75W Fans, 1000W Cooling units). |
| **L7** | Monitoring Dashboard | React + TypeScript frontend with live floor plan, analytics, and control center. |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)

### Quick Start (Run Both Backend & Frontend)

1. Navigate to the project root directory:
   ```bash
   cd software
   ```

2. Install dependencies for root, backend, and frontend:
   ```bash
   npm run install:all
   ```

3. Start both backend and frontend servers concurrently:
   ```bash
   npm run dev
   ```

   - **Frontend:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:3001](http://localhost:3001)
   - **WebSocket:** `ws://localhost:3001`

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v3, Recharts, Lucide React, Zustand
- **Backend:** Node.js, Express, Socket.IO, better-sqlite3
- **Database:** SQLite (persisted at `backend/data/smart_office.db`)

---

## 📊 Features & Navigation

- **Facility Overview:** Metric cards (Active Rooms, Devices ON, Power Draw, Energy Saved), Interactive Floor Plan (Floors 1 & 2), and Room Status Summary.
- **Live Monitoring:** Real-time grid of all room sensors, live device indicators, and streaming event log.
- **Rooms Management:** Filter rooms by floor, inspect individual room state, toggle **AUTO / MANUAL Mode**, and simulate occupancy via `ENTER ROOM` and `LEAVE ROOM` buttons.
- **Sensors Monitoring:** Dedicated cards for Occupancy, Temperature, Light, and Energy sensors with interactive sliders.
- **Devices Control:** Master device overview grouped by type (Lights, Fans, Cooling Units) with individual power ratings and toggle controls.
- **Automation Engine:** Configurable rule sets (Empty room shutdown, automatic lighting, high/moderate temperature control, comfortable temperature reduction).
- **Energy Analytics:** Recharts visual analytics showing power over time, device-wise consumption pie chart, room-wise power bar chart, and baseline vs. smart energy comparison.
- **Events & Alerts:** Historical log of all occupancy changes, device state updates, and automation rule triggers.
- **Simulation Control Center:** Start, pause, reset, step, adjust simulation speed (0.5× to 10×), and toggle Auto-Simulation mode.
- **Presentation Mode:** One-click academic presentation mode for clean faculty demonstrations.

---

## 🔬 Demonstration Guide (Faculty Presentation)

To perform a demonstration during evaluation:

1. Open the application at [http://localhost:5173](http://localhost:5173).
2. Go to **Simulation Control** and click **Start** (or enable **Auto-Simulation Mode**).
3. Navigate to **Rooms** and select **Room 01**.
4. Click **ENTER ROOM**:
   - Occupancy sensor changes to `Detected`.
   - Automation engine evaluates conditions.
   - Required devices (e.g. Light or Fan) switch ON automatically.
   - Room power draw increases in real time.
   - Event log records the automated action.
5. Adjust the **Temperature** slider above 26°C:
   - Cooling unit activates automatically.
6. Click **LEAVE ROOM**:
   - Occupancy sensor changes to `Not Detected`.
   - Empty room rule triggers, turning OFF all active devices.
   - Power consumption drops back down.
7. Open **Energy Analytics** to show the calculated energy savings curve.
8. Go to **Settings** and toggle **Presentation Mode** for an expanded presentation UI.

---

## 📡 REST API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rooms` | GET | Retrieve all rooms with embedded devices and sensors |
| `/api/rooms/:id` | GET | Retrieve detailed information for a specific room |
| `/api/rooms/:id/occupancy` | POST | Set room occupancy (`{ occupied: true/false }`) |
| `/api/rooms/:id/mode` | PUT | Toggle room mode (`{ mode: "auto" / "manual" }`) |
| `/api/rooms/:id/sensor` | PUT | Update room sensor value (`{ type, value }`) |
| `/api/devices` | GET | List all devices |
| `/api/devices/:id/toggle` | POST | Toggle device ON/OFF |
| `/api/automation/rules` | GET / PUT | Fetch or update automation rules & thresholds |
| `/api/energy/summary` | GET | Fetch system power, energy, baseline, and savings |
| `/api/energy/by-room` | GET | Fetch power & energy breakdown per room |
| `/api/events` | GET / DELETE| Fetch or clear system activity log |
| `/api/simulation/status` | GET | Get current simulation state |
| `/api/simulation/start` | POST | Start simulation engine |
| `/api/simulation/pause` | POST | Pause simulation engine |
| `/api/simulation/reset` | POST | Reset database and simulation state |
