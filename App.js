import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Linking, Alert } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av'; // ✨ Naya Audio Control ✨

// ✨ THE MAGIC FIX FOR EXPO SNACK (Bina '/app' ke) ✨
import firebase from 'firebase';

const firebaseConfig = {
  apiKey: "AIzaSyCWquftO39vqj83ZtYqtF_sDfkHVNpjd3k",
  authDomain: "bikripage-3aba6.firebaseapp.com",
  projectId: "bikripage-3aba6",
  storageBucket: "bikripage-3aba6.firebasestorage.app",
  messagingSenderId: "900882116436",
  appId: "1:900882116436:web:8a521d0308347ddcccdc92",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [orders, setOrders] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Aapki Asli Shop ID
  const currentShopId = "netajijhadustore-3581";

  useEffect(() => {
    // ✨ Silent Mode me aawaz laane ka force setup ✨
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.log("Audio Setup Error:", e);
      }
    };
    setupAudio();

    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Allow notifications for new orders!');
      }
    };
    requestPermissions();

    const unsubscribe = db.collection('orders')
      .where('shopId', '==', currentShopId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        let liveOrders = [];

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !isInitialLoad) {
            const newOrder = change.doc.data();

            if (newOrder.status === 'pending') {
              const customerName = newOrder.customerName || 'Customer';
              const amount = newOrder.totalAmount || 0;
              const msg = `${customerName} ne ${amount} rupaye ka naya order bheja hai.`;

              Speech.speak(msg, {
                language: 'hi-IN',
                pitch: 1.1,
                rate: 0.9,
              });

              Notifications.scheduleNotificationAsync({
                content: {
                  title: "New Order Received!",
                  body: `${customerName} just placed an order. Check the website.`,
                  sound: 'default',
                },
                trigger: null,
              });
            }
          }
        });

        snapshot.forEach((doc) => {
          const data = doc.data();
          // ✨ SMART FILTER: Ab sirf PENDING (Naye) order hi screen par dikhenge ✨
          if (data.status === 'pending') {
            liveOrders.push({ id: doc.id, ...data });
          }
        });

        setOrders(liveOrders);

        setTimeout(() => setIsInitialLoad(false), 2000);
      });

    return () => unsubscribe();
  }, [isInitialLoad]);

  const openWebsiteDashboard = () => {
    const url = `https://bikripage.github.io/Online/dashboard.html?shop=${currentShopId}`;
    Linking.openURL(url).catch((err) => console.error(err));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.statusBadge}>NEW ORDER</Text>
      </View>
      <Text style={styles.price}>₹{item.totalAmount}</Text>

      <TouchableOpacity style={styles.actionBtn} onPress={openWebsiteDashboard}>
        <Text style={styles.btnText}>Manage on Website</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BikriPage Shop Alert</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{alignItems: 'center', marginTop: 50}}>
            <Text style={{fontSize: 16, color: 'gray', fontWeight: 'bold'}}>No New Orders</Text>
            <Text style={{fontSize: 12, color: 'gray', marginTop: 5}}>All clear! Waiting for new customers...</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { backgroundColor: '#111827', padding: 20, paddingTop: 50, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#2563EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#E0E7FF', color: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' },
  price: { fontSize: 22, fontWeight: '900', color: '#16A34A', marginBottom: 15 },
  actionBtn: { backgroundColor: '#111827', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 15 }
});
