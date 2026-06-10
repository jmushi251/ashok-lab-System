-- Ashok Private Laboratory and Dispensary Management System
-- Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on roles and allow anyone to read roles (needed for login/signup bootstrap)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on roles" ON public.roles;
CREATE POLICY "Allow public read access on roles" ON public.roles FOR SELECT USING (true);

-- Initial Roles
INSERT INTO public.roles (name, description) VALUES
('Administrator', 'Full system access'),
('Receptionist', 'Manage patients, appointments, billing'),
('Doctor', 'Consultation, rx, lab requests'),
('Laboratory Technician', 'Lab workflow, test results'),
('Pharmacist', 'Dispense meds, manage inventory')
ON CONFLICT (name) DO NOTHING;

-- USERS (Extends Supabase Auth with our roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    role_id UUID REFERENCES public.roles(id),
    status VARCHAR(20) DEFAULT 'Active',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PATIENTS
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., APLD-2026-000001
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    dob DATE,
    phone_number VARCHAR(20),
    address TEXT,
    emergency_contact VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VISITS (Consultations)
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id),
    doctor_id UUID REFERENCES public.profiles(id),
    visit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    symptoms TEXT,
    diagnosis TEXT,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Active', -- Active, Completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LAB TESTS CATALOGUE
CREATE TABLE IF NOT EXISTS public.lab_test_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.lab_test_catalog (name, price) VALUES
('Malaria Test', 5000),
('Typhoid Test', 10000),
('HIV Test', 0),
('Pregnancy Test', 3000),
('Blood Sugar Test', 5000),
('Urinalysis', 7000),
('Full Blood Count', 15000)
ON CONFLICT (name) DO NOTHING;

-- LAB REQUESTS & RESULTS
CREATE TABLE IF NOT EXISTS public.lab_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES public.visits(id),
    patient_id UUID REFERENCES public.patients(id),
    requested_by UUID REFERENCES public.profiles(id),
    technician_id UUID REFERENCES public.profiles(id),
    test_id UUID REFERENCES public.lab_test_catalog(id),
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, In Progress, Completed
    result TEXT,
    comments TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVENTORY (Medicines)
CREATE TABLE IF NOT EXISTS public.medicines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    buying_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2) NOT NULL,
    quantity_available INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 10,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- We need a constraint for ON CONFLICT DO NOTHING to work.
CREATE UNIQUE INDEX IF NOT EXISTS medicines_name_key ON public.medicines (name);

INSERT INTO public.medicines (name, category, buying_price, selling_price, quantity_available, min_stock_level) VALUES
('Paracetamol', 'Painkiller', 500, 1000, 1000, 100),
('Amoxicillin', 'Antibiotic', 2000, 4000, 500, 50),
('ALU', 'Antimalarial', 1500, 3000, 200, 20)
ON CONFLICT (name) DO NOTHING;

-- PRESCRIPTIONS
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES public.visits(id),
    patient_id UUID REFERENCES public.patients(id),
    doctor_id UUID REFERENCES public.profiles(id),
    pharmacist_id UUID REFERENCES public.profiles(id),
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Dispensed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dispensed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID REFERENCES public.prescriptions(id),
    medicine_id UUID REFERENCES public.medicines(id),
    dosage VARCHAR(50),
    frequency VARCHAR(50),
    duration VARCHAR(50),
    instructions TEXT,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVENTORY TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medicine_id UUID REFERENCES public.medicines(id),
    transaction_type VARCHAR(20), -- Stock In, Stock Out, Dispensed
    quantity INTEGER NOT NULL,
    reference_id UUID, -- Can be prescription_item_id or null
    performed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVOICES & PAYMENTS
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(20) UNIQUE NOT NULL,
    patient_id UUID REFERENCES public.patients(id),
    visit_id UUID REFERENCES public.visits(id),
    total_amount DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Unpaid', -- Unpaid, Partial, Paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id),
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    reference_type VARCHAR(50), -- Consultation, Lab Test, Medicine
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- Cash, M-Pesa, Card, etc.
    recorded_by UUID REFERENCES public.profiles(id),
    receipt_number VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    action VARCHAR(255) NOT NULL,
    target_table VARCHAR(50),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.profiles(id),
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No Show')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LAB RESULTS
CREATE TABLE IF NOT EXISTS public.lab_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lab_request_id UUID REFERENCES public.lab_requests(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.lab_test_catalog(id),
    result_value TEXT,
    reference_range TEXT,
    remarks TEXT,
    technician_id UUID REFERENCES public.profiles(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE ROW LEVEL SECURITY ON ALL TABLES
-- Copy and run these commands in your Supabase SQL Editor to bypass policy restrictions for dev/demo usage:
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.visits DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_test_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.medicines DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prescriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.prescription_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lab_results DISABLE ROW LEVEL SECURITY;


