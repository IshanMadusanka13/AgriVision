import React, { useState, useEffect } from "react";
import { View, Button, Image, StyleSheet, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function CameraUploadScreen() {
  const [image, setImage] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

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

  const submitImage = async () => {
    if (!image) {
      Alert.alert("No image selected");
      return;
    }

    const formData = new FormData();
    const localUri = image;
    let filename = localUri.split("/").pop();
    if (filename && filename.includes("?")) {
      filename = filename.split("?")[0];
    }
    const match = /\.(\w+)$/.exec(filename ?? "");
    const mimeType = match ? `image/${match[1].toLowerCase()}` : "image/jpeg";

    if (Platform.OS === "web") {
      try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        // append blob with filename and type
        formData.append("file", blob, filename || "upload.jpg");
      } catch (err) {
        console.log("Error converting image to blob:", err);
        Alert.alert("Upload failed: could not read image on web.");
        return;
      }
    } else {
      formData.append("file", {
        uri: localUri,
        name: filename || "upload.jpg",
        type: mimeType,
      });
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        headers: {
          Accept: "application/json",
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
