-- ============================================================
-- SQL Playground seed script — reset to this baseline at any time
-- ============================================================

-- Drop in FK-safe reverse order
IF OBJECT_ID('dbo.Shippings',            'U') IS NOT NULL DROP TABLE dbo.Shippings;
IF OBJECT_ID('dbo.Orders',              'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Customers',           'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID('dbo.Teachers',            'U') IS NOT NULL DROP TABLE dbo.Teachers;
IF OBJECT_ID('dbo.percent_change',      'U') IS NOT NULL DROP TABLE dbo.percent_change;
IF OBJECT_ID('dbo.eagle_watch',         'U') IS NOT NULL DROP TABLE dbo.eagle_watch;
IF OBJECT_ID('dbo.number_data_types',   'U') IS NOT NULL DROP TABLE dbo.number_data_types;
IF OBJECT_ID('dbo.date_time_types',     'U') IS NOT NULL DROP TABLE dbo.date_time_types;
IF OBJECT_ID('dbo.supervisor_salaries', 'U') IS NOT NULL DROP TABLE dbo.supervisor_salaries;

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