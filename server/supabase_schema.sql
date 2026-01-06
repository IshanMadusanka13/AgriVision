-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (if not using Supabase Auth)
-- If using Supabase Auth, you can reference auth.users instead
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create analysis_sessions table to store all user inputs and results
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,

    -- NPK Input Data
    nitrogen DECIMAL(10, 2),
    phosphorus DECIMAL(10, 2),
    potassium DECIMAL(10, 2),

    -- Environmental Data
    ph DECIMAL(4, 2),
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    location TEXT,
    location_lat DECIMAL(10, 7),
    location_lng DECIMAL(10, 7),

    -- Image Data
    original_image_url TEXT,
    annotated_image_url TEXT,

    -- Growth Stage Detection
    growth_stage TEXT,
    growth_stage_confidence DECIMAL(5, 2),
    flower_count INTEGER DEFAULT 0,
    fruit_count INTEGER DEFAULT 0,
    leaf_count INTEGER DEFAULT 0,
    ripening_count INTEGER DEFAULT 0,

    -- Weather Condition
    current_weather TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create weather_forecast table to store 7-day forecast details
CREATE TABLE IF NOT EXISTS public.weather_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

    -- Forecast Day
    forecast_date DATE NOT NULL,
    day_index INTEGER NOT NULL, -- 0-6 for 7 days

    -- Weather Data
    condition TEXT, -- sunny, rainy, cloudy
    temperature DECIMAL(5, 2),
    temp_min DECIMAL(5, 2),
    temp_max DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    precipitation_chance INTEGER,
    wind_speed DECIMAL(5, 2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create npk_status table to store NPK analysis results
CREATE TABLE IF NOT EXISTS public.npk_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

    -- Nitrogen Status
    nitrogen_level TEXT, -- low, optimal, high
    nitrogen_current DECIMAL(10, 2),
    nitrogen_optimal_range TEXT,

    -- Phosphorus Status
    phosphorus_level TEXT, -- low, optimal, high
    phosphorus_current DECIMAL(10, 2),
    phosphorus_optimal_range TEXT,

    -- Potassium Status
    potassium_level TEXT, -- low, optimal, high
    potassium_current DECIMAL(10, 2),
    potassium_optimal_range TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create fertilizer_recommendations table to store weekly plan
CREATE TABLE IF NOT EXISTS public.fertilizer_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

    -- Day Plan
    day_name TEXT NOT NULL, -- Monday, Tuesday, etc.
    day_index INTEGER,
    fertilizer_type TEXT NOT NULL,
    amount TEXT NOT NULL,
    amount_adjusted TEXT,
    method TEXT,
    watering TEXT,

    -- Forecast Integration
    forecast_condition TEXT,
    forecast_temperature DECIMAL(5, 2),
    forecast_humidity DECIMAL(5, 2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create recommendations_metadata table for warnings and tips
CREATE TABLE IF NOT EXISTS public.recommendations_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,

    warnings TEXT[], -- Array of warning messages
    tips TEXT[], -- Array of tip messages

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user_id ON public.analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON public.analysis_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_weather_forecasts_session_id ON public.weather_forecasts(session_id);
CREATE INDEX IF NOT EXISTS idx_npk_status_session_id ON public.npk_status(session_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_recommendations_session_id ON public.fertilizer_recommendations(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_metadata_session_id ON public.recommendations_metadata(session_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to analysis_sessions
CREATE TRIGGER update_analysis_sessions_updated_at
    BEFORE UPDATE ON public.analysis_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npk_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (users can only access their own data)

-- Users table policies
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Analysis sessions policies
CREATE POLICY "Users can view own analysis sessions" ON public.analysis_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis sessions" ON public.analysis_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis sessions" ON public.analysis_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis sessions" ON public.analysis_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Weather forecasts policies
CREATE POLICY "Users can view own weather forecasts" ON public.weather_forecasts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = weather_forecasts.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own weather forecasts" ON public.weather_forecasts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = weather_forecasts.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

-- NPK status policies
CREATE POLICY "Users can view own npk status" ON public.npk_status
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = npk_status.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own npk status" ON public.npk_status
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = npk_status.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

-- Fertilizer recommendations policies
CREATE POLICY "Users can view own fertilizer recommendations" ON public.fertilizer_recommendations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = fertilizer_recommendations.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own fertilizer recommendations" ON public.fertilizer_recommendations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = fertilizer_recommendations.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

-- Recommendations metadata policies
CREATE POLICY "Users can view own recommendations metadata" ON public.recommendations_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = recommendations_metadata.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own recommendations metadata" ON public.recommendations_metadata
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analysis_sessions
            WHERE analysis_sessions.id = recommendations_metadata.session_id
            AND analysis_sessions.user_id = auth.uid()
        )
    );

-- Create storage bucket for images (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('plant-images', 'plant-images', true);

-- Storage policies for images bucket
-- CREATE POLICY "Users can upload own images" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'plant-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Public can view images" ON storage.objects
--     FOR SELECT USING (bucket_id = 'plant-images');
