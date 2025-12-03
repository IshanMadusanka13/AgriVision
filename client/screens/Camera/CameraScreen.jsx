import React, { useState, useEffect } from "react";
import { View, Button, Image, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function CameraUploadScreen() {
  const [image, setImage] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // -------------------------------
  // Open Image Library
  // -------------------------------
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // -------------------------------
  // Take Photo Using Camera
  // -------------------------------
  const takePhoto = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    setCameraVisible(true);
  };

  const onPictureTaken = async (photoUri) => {
    setImage(photoUri);
    setCameraVisible(false);
  };

  // -------------------------------
  // Upload Image to FastAPI Backend
  // -------------------------------
  const submitImage = async () => {
    if (!image) {
      Alert.alert("No image selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", {
      uri: image,
      name: "upload.jpg",
      type: "image/jpeg",
    });

    try {
      const res = await fetch("http://http://127.0.0.1:8000/upload/", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await res.json();
      console.log("Response:", data);
      Alert.alert("Uploaded!", JSON.stringify(data));
    } catch (error) {
      console.log(error);
      Alert.alert("Upload failed");
    }
  };

  // -------------------------------
  // Camera View Component
  // -------------------------------
  if (cameraVisible) {
    return (
      <CameraView
        style={{ flex: 1 }}
        onPictureSaved={(photo) => onPictureTaken(photo.uri)}
        enableHighAccuracy
      />
    );
  }

  return (
    <View style={styles.container}>
      {image && <Image source={{ uri: image }} style={styles.image} />}

      <Button title="Take Photo" onPress={takePhoto} />
      <Button title="Select From Gallery" onPress={pickImage} />
      <Button title="Submit" onPress={submitImage} color="green" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    gap: 20,
    justifyContent: "center",
    padding: 20,
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: 10,
  },
});
