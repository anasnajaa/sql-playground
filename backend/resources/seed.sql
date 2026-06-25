-- ============================================================
-- SQL Playground seed script — reset to this baseline at any time
-- ============================================================

-- Drop in FK-safe reverse order
IF OBJECT_ID('dbo.kuwait_education_level_by_gov',  'U') IS NOT NULL DROP TABLE dbo.kuwait_education_level_by_gov;
IF OBJECT_ID('dbo.kuwait_nationality_by_gov',       'U') IS NOT NULL DROP TABLE dbo.kuwait_nationality_by_gov;
IF OBJECT_ID('dbo.kuwait_population_count_by_area', 'U') IS NOT NULL DROP TABLE dbo.kuwait_population_count_by_area;
IF OBJECT_ID('dbo.kuwait_work_status_by_age_group', 'U') IS NOT NULL DROP TABLE dbo.kuwait_work_status_by_age_group;
IF OBJECT_ID('dbo.kuwait_area',                     'U') IS NOT NULL DROP TABLE dbo.kuwait_area;
IF OBJECT_ID('dbo.kuwait_governorate',              'U') IS NOT NULL DROP TABLE dbo.kuwait_governorate;
IF OBJECT_ID('dbo.students',                        'U') IS NOT NULL DROP TABLE dbo.students;
IF OBJECT_ID('dbo.Shippings',            'U') IS NOT NULL DROP TABLE dbo.Shippings;
IF OBJECT_ID('dbo.Orders',              'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Customers',           'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID('dbo.Teachers',            'U') IS NOT NULL DROP TABLE dbo.Teachers;
IF OBJECT_ID('dbo.percent_change',      'U') IS NOT NULL DROP TABLE dbo.percent_change;
IF OBJECT_ID('dbo.eagle_watch',         'U') IS NOT NULL DROP TABLE dbo.eagle_watch;
IF OBJECT_ID('dbo.number_data_types',   'U') IS NOT NULL DROP TABLE dbo.number_data_types;
IF OBJECT_ID('dbo.date_time_types',     'U') IS NOT NULL DROP TABLE dbo.date_time_types;
IF OBJECT_ID('dbo.supervisor_salaries', 'U') IS NOT NULL DROP TABLE dbo.supervisor_salaries;
IF OBJECT_ID('dbo.employees',           'U') IS NOT NULL DROP TABLE dbo.employees;
IF OBJECT_ID('dbo.departments',         'U') IS NOT NULL DROP TABLE dbo.departments;

-- ── Kuwait lookup tables ──────────────────────────────────────────────────

CREATE TABLE kuwait_governorate (
    id             INT PRIMARY KEY,
    governorate_en NVARCHAR(100),
    governorate_ar NVARCHAR(100)
);

CREATE TABLE kuwait_area (
    id           INT PRIMARY KEY,
    area_name_en NVARCHAR(200),
    area_name_ar NVARCHAR(200)
);

-- ── Kuwait fact tables ────────────────────────────────────────────────────

CREATE TABLE kuwait_education_level_by_gov (
    id                                   INT IDENTITY(1,1) PRIMARY KEY,
    edu_illiterate                       INT,
    edu_read_write                       INT,
    edu_primary                          INT,
    edu_intermediate                     INT,
    edu_secondary                        INT,
    edu_above_secondary_below_university INT,
    edu_university                       INT,
    edu_above_university                 INT,
    edu_not_stated                       INT,
    gender                               VARCHAR(10),
    governorate_id                       INT,
    FOREIGN KEY (governorate_id) REFERENCES kuwait_governorate(id)
);

CREATE TABLE kuwait_nationality_by_gov (
    id                 INT IDENTITY(1,1) PRIMARY KEY,
    kuwaiti_male       INT,
    kuwaiti_female     INT,
    non_kuwaiti_male   INT,
    non_kuwaiti_female INT,
    governorate_id     INT,
    FOREIGN KEY (governorate_id) REFERENCES kuwait_governorate(id)
);

CREATE TABLE kuwait_population_count_by_area (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    population_count INT,
    area_id          INT,
    FOREIGN KEY (area_id) REFERENCES kuwait_area(id)
);

CREATE TABLE kuwait_work_status_by_age_group (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    age_group             VARCHAR(20),
    gender                VARCHAR(10),
    government_worker     INT,
    non_government_worker INT,
    domestic_worker       INT,
    unemployed            INT,
    student               INT,
    full_time_home_worker INT,
    retired_with_income   INT,
    not_stated            INT
);

-- 1. Customers
CREATE TABLE Customers (
    customer_id INT PRIMARY KEY,
    first_name  VARCHAR(50),
    last_name   VARCHAR(50),
    age         INT,
    country     VARCHAR(50)
);

-- 2. Orders
CREATE TABLE Orders (
    order_id    INT PRIMARY KEY,
    item        VARCHAR(50),
    amount      DECIMAL(10, 2),
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
);

-- 3. Shippings
CREATE TABLE Shippings (
    shipping_id INT PRIMARY KEY,
    status      VARCHAR(50),
    customer    INT,
    FOREIGN KEY (customer) REFERENCES Customers(customer_id)
);

-- 4. Teachers
CREATE TABLE Teachers (
   id INT IDENTITY(1,1) PRIMARY KEY,
   first_name  VARCHAR(20),
   last_name   VARCHAR(50),
   school      VARCHAR(50),
   hire_date   DATE,
   salary      NUMERIC
);

-- 4. Teachers
CREATE TABLE percent_change (
   department varchar(20),
   spend_2014 numeric(10,2),
   spend_2017 numeric(10,2)
);

-- 5. Teachers
CREATE TABLE eagle_watch (
   observed_date DATE,
   eagles_seen INT
);

CREATE TABLE number_data_types (
    numeric_column numeric(20,5),
    real_column real,
    double_column double precision
);

CREATE TABLE date_time_types (
    
    timestamp_column DATETIMEOFFSET, 
    interval_column  INT 
);

-- supervisor_salaries (populated from supervisor_salaries.csv at reset time)
CREATE TABLE supervisor_salaries (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    town       VARCHAR(100),
    county     VARCHAR(100),
    supervisor VARCHAR(100),
    start_date DATE,
    salary     NUMERIC(10,2),
    benefits   NUMERIC(10,2)
);

CREATE TABLE students (
    student_id      INT PRIMARY KEY,
    first_name      VARCHAR(50),
    last_name       VARCHAR(50),
    gender          VARCHAR(10),
    date_of_birth   DATE,
    enrollment_year INT,
    gpa             NUMERIC(3,2)
);

CREATE TABLE departments (
    dept_id BIGINT IDENTITY(1,1),
    dept    VARCHAR(100),
    city    VARCHAR(100),
    CONSTRAINT dept_key        PRIMARY KEY (dept_id),
    CONSTRAINT dept_city_unique UNIQUE (dept, city)
);

CREATE TABLE employees (
    emp_id     BIGINT IDENTITY(1,1),
    first_name VARCHAR(100),
    last_name  VARCHAR(100),
    salary     INT,
    dept_id    BIGINT CONSTRAINT fk_dept REFERENCES departments (dept_id),
    CONSTRAINT emp_key        PRIMARY KEY (emp_id),
    CONSTRAINT emp_dept_unique UNIQUE (emp_id, dept_id)
);



-- 5. Seed Customers
INSERT INTO Customers (customer_id, first_name, last_name, age, country) VALUES
(1, 'John',   'Doe',       31, 'USA'),
(2, 'Robert', 'Luna',      22, 'USA'),
(3, 'David',  'Robinson',  22, 'UK'),
(4, 'John',   'Reinhardt', 25, 'UK'),
(5, 'Betty',  'Doe',       28, 'UAE');

-- 5. Seed Orders
INSERT INTO Orders (order_id, item, amount, customer_id) VALUES
(1, 'Keyboard', 400.00,   4),
(2, 'Mouse',    300.00,   4),
(3, 'Monitor',  12000.00, 3),
(4, 'Keyboard', 400.00,   1),
(5, 'Mousepad', 250.00,   2);

-- 6. Seed Shippings
INSERT INTO Shippings (shipping_id, status, customer) VALUES
(1, 'Pending',   2),
(2, 'Pending',   4),
(3, 'Delivered', 3),
(4, 'Pending',   5),
(5, 'Delivered', 1);

-- 7. Seed Teachers
INSERT INTO Teachers (first_name, last_name, school, hire_date, salary) VALUES 
('Janet', 'Smith', 'F.D. Roosevelt HS', '2011-10-30' , 36200),
('Lee' , 'Reynolds', 'F.D. Roosevelt HS' , '1993-05-22' , 65000),
('Samuel', 'Cole' , 'Myers Middle School' ,'2005-08-01' , 43500),
('Samantha', 'Bush', 'Myers Middle School', '2011-10-30', 36200),
('Betty', 'Diaz', 'Myers Middle School', '2005-08-30', 43500),
('Kathleen', 'Roush', 'F.D. Roosevelt HS', '2010-10-22', 38500);

-- 7. Seed Percent Change
INSERT INTO percent_change
VALUES
   ('Building', 250000, 289000), ('Assessor', 178556, 179500),
   ('Library', 87777, 90001), ('Clerk', 451980, 650000),
   ('Police', 250000, 223000), ('Recreation', 199000, 195000);

INSERT INTO eagle_watch (observed_date, eagles_seen)
VALUES 
    ('2026-01-15', 3),
    ('2026-03-22', 1),
    ('2026-05-02', 5),
    ('2026-06-13', 2),
    ('2026-11-28', 4);

INSERT INTO number_data_types
VALUES
    (.7, .7, .7),
    (2.13579, 2.13579, 2.13579),
    (2.1357987654, 2.1357987654, 2.1357987654);

INSERT INTO date_time_types (timestamp_column, interval_column)
VALUES
    -- 1. '2022-12-31 01:00 EST' -> EST is UTC-5
    ('2022-12-31 01:00:00 -05:00', 2),
    
    -- 2. '2022-12-31 01:00 -8' -> Explicitly formatted as -08:00 (1 month ≈ 30 days)
    ('2022-12-31 01:00:00 -08:00', 30),
    
    -- 3. 'Australia/Melbourne' -> Melbourne is UTC+11 during Daylight Saving Time in Dec (1 century = 36525 days)
    ('2022-12-31 01:00:00 +11:00', 36525),
    
    -- 4. now() -> SYSDATETIMEOFFSET() (1 week = 7 days)
    (SYSDATETIMEOFFSET(), 7);

-- Seed Students
INSERT INTO students (student_id, first_name, last_name, gender, date_of_birth, enrollment_year, gpa) VALUES
(1,  'Sarah',    'Al-Otaibi',   'Female', '2004-03-14', 2022, 3.85),
(2,  'Ahmed',    'Al-Mutairi',  'Male',   '2003-08-22', 2021, 3.10),
(3,  'Fatima',   'Dashti',      'Female', '2005-01-10', 2023, 3.92),
(4,  'Khaled',   'Al-Enezi',    'Male',   '2004-11-05', 2022, 2.75),
(5,  'Maryam',   'Al-Fadli',    'Female', '2003-05-19', 2021, 3.45),
(6,  'Abdullah', 'Al-Shammari', 'Male',   '2004-07-30', 2022, 3.60),
(7,  'Reem',     'Al-Saeed',    'Female', '2005-09-25', 2023, 2.98),
(8,  'Yousef',   'Al-Kandari',  'Male',   '2003-12-02', 2021, 3.80),
(9,  'Noura',    'Al-Rashed',   'Female', '2004-02-17', 2022, 3.67),
(10, 'Bader',    'Al-Ali',      'Male',   '2005-06-11', 2023, 3.25);

-- Seed Departments & Employees
INSERT INTO departments (dept, city) VALUES
    ('Tax', 'Atlanta'),
    ('IT',  'Boston');

INSERT INTO employees (first_name, last_name, salary, dept_id) VALUES
    ('Nancy', 'Jones',  62500, 1),
    ('Lee',   'Smith',  59300, 1),
    ('Soo',   'Nguyen', 83000, 2),
    ('Janet', 'King',   95000, 2);