import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonStyles } from "../../../components/CommonStyles"
import { db } from "../../../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";

const EditableInputRow = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
}) => {
  return (
    <View style={CommonStyles.editableTextContainer}>
      <Text style={CommonStyles.editableTextLabel}>{label}:</Text>
      <TextInput
        style={CommonStyles.editableTextInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </View>
  );
};

export default function ArtisanAccountSheet() {
  const { sheetId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [workmanship, setWorkmanship] = useState([]);
  const [sheetTitle, setSheetTitle] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₦");

  const isExistingSheet = !!sheetId;

  useEffect(() => {
    const fetchSheetData = async () => {
      if (!user) {
        Alert.alert("Error", "User not authenticated.");
        setLoading(false);
        return;
      }

      try {
        const storedCurrencyCode = await AsyncStorage.getItem("userCurrency");
        if (storedCurrencyCode) {
          const symbols = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };
          setCurrencySymbol(symbols[storedCurrencyCode] || "₦");
        }
      } catch (e) {
        console.error("Failed to load currency from storage", e);
      }

      if (isExistingSheet) {
        try {
          const docRef = doc(db, `users/${user.uid}/artisanSheets`, sheetId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setExpenses(data.expenses || []);
            setWorkmanship(data.workmanship || []);
            setSheetTitle(data.title || "");
          } else {
            Alert.alert("Error", "Sheet not found.");
          }
        } catch (e) {
          console.error("Error fetching document:", e);
          Alert.alert("Error", "Failed to load sheet data.");
        }
      } else {
        setExpenses([
          { id: "logistics", name: "Logistics", amount: "" },
          { id: "phone", name: "Phone Calls", amount: "" },
          { id: "feeding", name: "Feeding", amount: "" },
        ]);
        setWorkmanship([
          { id: Date.now().toString(), description: "", amount: "" },
        ]);
        setSheetTitle(`New Artisan Sheet - ${new Date().toLocaleDateString()}`);
      }
      setLoading(false);
    };

    fetchSheetData();
  }, [sheetId, user]);

  const handleExpenseChange = (id, value) => {
    const newExpenses = expenses.map((exp) =>
      exp.id === id ? { ...exp, amount: value } : exp
    );
    setExpenses(newExpenses);
  };

  const addWorkmanshipEntry = () => {
    setWorkmanship([
      ...workmanship,
      { id: Date.now().toString(), description: "", amount: "" },
    ]);
  };

  const handleWorkmanshipChange = (index, field, value) => {
    const newWorkmanship = [...workmanship];
    newWorkmanship[index][field] = value;
    setWorkmanship(newWorkmanship);
  };

  const calculateTotalExpenses = () => {
    return expenses.reduce((sum, exp) => {
      return sum + parseFloat(exp.amount || 0);
    }, 0);
  };

  const calculateTotalWorkmanship = () => {
    return workmanship.reduce((sum, entry) => {
      return sum + parseFloat(entry.amount || 0);
    }, 0);
  };

  const handleSaveOrSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to save data.");
      return;
    }

    const totalExpenses = calculateTotalExpenses();
    const totalWorkmanship = calculateTotalWorkmanship();
    const difference = totalWorkmanship - totalExpenses;

    let alertMessage = "";
    if (difference > 0) {
      alertMessage = `Congratulations, you made ${currencySymbol}${difference.toFixed(
        2
      )} profit! 🎉`;
    } else if (difference < 0) {
      alertMessage = `Sorry, you made a loss of ${currencySymbol}${Math.abs(
        difference
      ).toFixed(2)}. Next time can be better. 📉`;
    } else {
      alertMessage = "You broke even! No profit, no loss. 📊";
    }

    Alert.alert("Calculation Result", alertMessage);

    const sheetData = {
      title: sheetTitle,
      type: "artisan",
      expenses: expenses.map((exp) => ({
        name: exp.name,
        amount: parseFloat(exp.amount || 0),
      })),
      workmanship: workmanship.map((entry) => ({
        description: entry.description,
        amount: parseFloat(entry.amount || 0),
      })),
      totalWorkmanship: totalWorkmanship,
      totalExpenses: totalExpenses,
      profitOrLoss: difference,
      timestamp: serverTimestamp(),
    };

    try {
      if (isExistingSheet) {
        const docRef = doc(db, `users/${user.uid}/artisanSheets`, sheetId);
        await updateDoc(docRef, sheetData);
        Alert.alert("Success", "Sheet updated successfully!");
      } else {
        await addDoc(
          collection(db, `users/${user.uid}/artisanSheets`),
          sheetData
        );
        Alert.alert("Success", "New sheet saved to Firebase!");
      }
    } catch (e) {
      console.error("Error saving document: ", e);
      Alert.alert("Error", "Failed to save data to Firebase.");
    }
  };

  if (loading) {
    return (
      <View style={CommonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <ScrollView style={CommonStyles.container}>
      <View style={styles.sheetHeader}>
        <TextInput
          style={styles.titleInput}
          value={sheetTitle}
          onChangeText={setSheetTitle}
          placeholder="Enter a title for this sheet"
        />
      </View>

      <View style={styles.sheetContent}>
        <View style={styles.section}>
          <Text style={CommonStyles.sectionHeader}>EXPENSES</Text>
          {expenses.map((exp) => (
            <EditableInputRow
              key={exp.id}
              label={exp.name}
              value={exp.amount}
              onChangeText={(text) => handleExpenseChange(exp.id, text)}
              keyboardType="numeric"
            />
          ))}
          <Text style={CommonStyles.totalText}>
            Total Expenses: {currencySymbol}
            {calculateTotalExpenses().toFixed(2)}
          </Text>
        </View>

        <View style={CommonStyles.thinLine} />

        <View style={styles.section}>
          <Text style={CommonStyles.sectionHeader}>WORKMANSHIP</Text>
          {workmanship.map((entry, index) => (
            <View key={entry.id} style={styles.workmanshipEntry}>
              <EditableInputRow
                label="Work Description"
                value={entry.description}
                onChangeText={(text) =>
                  handleWorkmanshipChange(index, "description", text)
                }
              />
              <EditableInputRow
                label="Amount Received"
                value={entry.amount}
                onChangeText={(text) =>
                  handleWorkmanshipChange(index, "amount", text)
                }
                keyboardType="numeric"
              />
            </View>
          ))}
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={addWorkmanshipEntry}
          >
            <Text style={styles.addMoreButtonText}>+ Add Work Entry</Text>
          </TouchableOpacity>
          <Text style={CommonStyles.totalText}>
            Total Workmanship: {currencySymbol}
            {calculateTotalWorkmanship().toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          style={CommonStyles.submitButton}
          onPress={handleSaveOrSubmit}
        >
          <Text style={CommonStyles.submitButtonText}>
            {isExistingSheet ? "Update Sheet" : "Save Sheet & Calculate"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    marginBottom: 20,
    marginTop: 50,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  sheetContent: {
    paddingBottom: 50,
  },
  section: {
    marginBottom: 20,
  },
  workmanshipEntry: {
    backgroundColor: "#e0ffe0",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#c6ecc6",
  },
  addMoreButton: {
    backgroundColor: "#6c757d",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  addMoreButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});