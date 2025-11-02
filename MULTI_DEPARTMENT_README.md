# 🏢 MULTI-AVDELING SYSTEM - Rejestrator Postojów

## 🌟 Nowe Funkcjonalności

### 🔑 SUPER ADMIN/SJEF:
- ✅ **Tworzy nowe oddziały** (Haslestad, Justeverkt, inne)
- ✅ **Przydziela managerów** do każdego oddziału
- ✅ **Dostęp do wszystkich oddziałów** - pełna kontrola
- ✅ **Porównuje wyniki** między oddziałami
- ✅ **Centralne zarządzanie** użytkownikami i maszynami

### 👨‍💼 AVDELINGSLEDER (Manager oddziału):
- ✅ **Zarządza tylko swoim oddziałem** - izolacja danych
- ✅ **Dodaje maszyny** dla swojego oddziału
- ✅ **Zarządza operatorami** w swoim oddziale
- ✅ **Widzi tylko dane** ze swojego oddziału
- ✅ **Raporty per oddział** - niezależne statystyki

### 👷 OPERATØR:
- ✅ **Przypisany do konkretnego oddziału** - bezpieczeństwo danych
- ✅ **Rejestruje postoje** tylko dla maszyn w swoim oddziale
- ✅ **Interfejs dostosowany** do oddziału
- ✅ **Automatyczne filtrowanie** danych

## 🏗️ JAK TO DZIAŁA:

### 1. TWORZENIE ODDZIAŁU:
```
Sjef loguje się → "Opprett ny avdeling" → 
Wpisuje: "Justeverkt" → 
System tworzy nowy oddział
```

### 2. KONFIGURACJA ODDZIAŁU:
```
Sjef dodaje maszyny dla Justeverkt
Tworzy konta operatorów dla Justeverkt
Przydziela managera dla Justeverkt
```

### 3. NIEZALEŻNE DZIAŁANIE:
```
Każdy oddział działa jak osobny system
Dane są oddzielone między oddziałami
Raporty generowane per oddział
```

## 📊 KORZYŚCI:

### ✅ SKALOWALNOŚĆ:
- **Jeden system** dla całej firmy
- **Łatwe dodawanie** nowych oddziałów
- **Centralne zarządzanie** - wszystko w jednym miejscu

### ✅ BEZPIECZEŃSTWO:
- **Operatorzy widzą tylko swój oddział** - izolacja danych
- **Dane są izolowane** między oddziałami
- **Kontrola dostępu** na poziomie oddziału

### ✅ ANALITYKA:
- **Porównania między oddziałami** - benchmarking
- **Benchmarking wydajności** - który oddział lepszy
- **Centralne raporty** dla kierownictwa

## 🚀 INSTALACJA I KONFIGURACJA

### 1. Przygotowanie bazy danych:
```bash
# Uruchom skrypt konfiguracyjny
node setup-multi-department.js
```

### 2. Struktura bazy danych:
```sql
-- Nowe tabele i kolumny:
departments (id, name, display_name, is_active)
user_passwords + department_id, role, display_name
machines + department_id
downtimes + department_id
```

### 3. Domyślne oddziały:
- **Haslestad** - istniejący oddział (wszystkie obecne dane)
- **Justeverkt** - nowy oddział z przykładowymi danymi

## 🔑 KONTA DOSTĘPOWE

### Super Administrator:
```
Użytkownik: superadmin
Hasło: 123456
Dostęp: Wszystkie oddziały + zarządzanie systemem
```

### Haslestad (istniejące konta):
```
Wszystkie obecne konta zostają przypisane do Haslestad
admin, sjef, operatør, Dag, Kveld, etc.
```

### Justeverkt (nowe przykładowe konta):
```
Manager: jv_manager / 123456
Operator 1: jv_operator1 / 123456
Operator 2: jv_operator2 / 123456
```

## 🎯 PRZEPŁYW PRACY

### 1. Wybór oddziału:
- Użytkownik wybiera oddział z listy
- System sprawdza uprawnienia
- Przekierowanie do odpowiedniego interfejsu

### 2. Super Admin:
- Dostęp do panelu zarządzania
- Tworzenie nowych oddziałów
- Zarządzanie użytkownikami
- Analityka międzyoddziałowa

### 3. Manager/Operator:
- Dostęp tylko do swojego oddziału
- Wszystkie funkcje jak wcześniej
- Dane filtrowane automatycznie

## 🔧 KONFIGURACJA TECHNICZNA

### Nowe komponenty:
```
MultiDepartmentTracker.tsx - główny koordynator
DepartmentSelector.tsx - wybór oddziału
SuperAdminPanel.tsx - panel super admina
DepartmentDowntimeTracker.tsx - tracker per oddział
```

### Aktualizacje bazy:
```sql
-- Dodane kolumny department_id do wszystkich tabel
-- Nowe polityki RLS dla izolacji danych
-- Triggery do automatycznego przypisywania oddziału
-- Widoki dla łatwych zapytań
```

## 💰 MODEL BIZNESOWY

### PRICING PER ODDZIAŁ:
- **Podstawowa opłata** za system
- **Dodatkowa opłata** za każdy oddział
- **Skalowalne koszty** - płacisz za to czego używasz

### KORZYŚCI FINANSOWE:
- **Jeden system** zamiast wielu osobnych
- **Centralne utrzymanie** - niższe koszty IT
- **Łatwa ekspansja** - nowe oddziały w minuty

## 🚀 URUCHOMIENIE

### 1. Konfiguracja:
```bash
# Zainstaluj zależności
npm install

# Skonfiguruj bazę danych
node setup-multi-department.js

# Uruchom aplikację
npm run dev
```

### 2. Pierwsze logowanie:
1. Otwórz http://localhost:3000
2. Wybierz oddział z listy
3. Zaloguj się używając powyższych kont
4. Ciesz się nowym systemem! 🎉

## 📈 PRZYSZŁE ROZSZERZENIA

### Planowane funkcje:
- **API dla integracji** z innymi systemami
- **Mobilna aplikacja** dedykowana
- **Zaawansowana analityka** AI/ML
- **Automatyczne raporty** email/SMS
- **Integracja z ERP** - SAP, Oracle, etc.

## 🆘 WSPARCIE

### W przypadku problemów:
1. Sprawdź logi w konsoli przeglądarki
2. Zweryfikuj połączenie z Supabase
3. Upewnij się że migracja bazy się udała
4. Skontaktuj się z administratorem systemu

---

**🎉 Gratulacje! Masz teraz nowoczesny, skalowalny system multi-avdeling!**

*System zaprojektowany z myślą o przyszłości - łatwo dodawać nowe oddziały, zarządzać użytkownikami i analizować dane w jednym miejscu.*