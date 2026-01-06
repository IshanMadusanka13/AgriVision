-- Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-images', 'plant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'plant-images');

-- Create storage policy to allow public access to images
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'plant-images');

-- Create storage policy to allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'plant-images');

-- Create storage policy to allow users to update their own images
CREATE POLICY "Users can update own images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'plant-images');
