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
import { CommonStyles } from "../../../components/CommonStyles";
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

export default function SalaryAccountSheet() {
  const { sheetId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salary, setSalary] = useState("");
  const [dailyTransportCost, setDailyTransportCost] = useState("");
  const [dailyLunchCost, setDailyLunchCost] = useState("");
  const [workDaysMonthly, setWorkDaysMonthly] = useState("");
  const [otherExpenses, setOtherExpenses] = useState([]);
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
          const docRef = doc(db, `users/${user.uid}/salarySheets`, sheetId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSalary(data.salary?.toString() || "");
            setDailyTransportCost(data.dailyTransportCost?.toString() || "");
            setDailyLunchCost(data.dailyLunchCost?.toString() || "");
            setWorkDaysMonthly(data.workDaysMonthly?.toString() || "");
            setOtherExpenses(data.otherExpenses || []);
            setSheetTitle(data.title || "");
          } else {
            Alert.alert("Error", "Sheet not found.");
          }
        } catch (e) {
          console.error("Error fetching document:", e);
          Alert.alert("Error", "Failed to load sheet data.");
        }
      } else {
        setOtherExpenses([
          { id: "rent", name: "Rent", amount: "" },
          { id: "subscriptions", name: "Subscriptions", amount: "" },
        ]);
        setSheetTitle(`New Salary Sheet - ${new Date().toLocaleDateString()}`);
      }
      setLoading(false);
    };

    fetchSheetData();
  }, [sheetId, user]);

  const handleOtherExpenseChange = (id, value) => {
    const newExpenses = otherExpenses.map((exp) =>
      exp.id === id ? { ...exp, amount: value } : exp
    );
    setOtherExpenses(newExpenses);
  };

  const addOtherExpense = () => {
    setOtherExpenses([
      ...otherExpenses,
      { id: Date.now().toString(), name: "", amount: "" },
    ]);
  };

  const calculateTotalExpenses = () => {
    const transport =
      parseFloat(dailyTransportCost || 0) * parseFloat(workDaysMonthly || 0);
    const lunch =
      parseFloat(dailyLunchCost || 0) * parseFloat(workDaysMonthly || 0);
    const other = otherExpenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount || 0),
      0
    );
    return transport + lunch + other;
  };

  const handleSaveOrSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to save data.");
      return;
    }

    const totalExpenses = calculateTotalExpenses();
    const totalSalary = parseFloat(salary || 0);
    const difference = totalSalary - totalExpenses;

    let alertMessage = "";
    if (difference > 0) {
      alertMessage = `Congratulations, you have ${currencySymbol}${difference.toFixed(
        2
      )} remaining after expenses! 🎉`;
    } else if (difference < 0) {
      alertMessage = `Sorry, your expenses exceed your salary by ${currencySymbol}${Math.abs(
        difference
      ).toFixed(2)}. Consider reviewing your spending. 📉`;
    } else {
      alertMessage = "You broke even! No extra cash, no deficit. 📊";
    }

    Alert.alert("Monthly Balance", alertMessage);

    const sheetData = {
      title: sheetTitle,
      type: "salary",
      salary: totalSalary,
      dailyTransportCost: parseFloat(dailyTransportCost || 0),
      dailyLunchCost: parseFloat(dailyLunchCost || 0),
      workDaysMonthly: parseFloat(workDaysMonthly || 0),
      otherExpenses: otherExpenses.map((exp) => ({
        name: exp.name,
        amount: parseFloat(exp.amount || 0),
      })),
      totalExpenses: totalExpenses,
      remainingBalance: difference,
      timestamp: serverTimestamp(),
    };

    try {
      if (isExistingSheet) {
        const docRef = doc(db, `users/${user.uid}/salarySheets`, sheetId);
        await updateDoc(docRef, sheetData);
        Alert.alert("Success", "Sheet updated successfully!");
      } else {
        await addDoc(
          collection(db, `users/${user.uid}/salarySheets`),
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
          <Text style={CommonStyles.sectionHeader}>SALARY</Text>
          <EditableInputRow
            label="Monthly Salary"
            value={salary}
            onChangeText={setSalary}
            keyboardType="numeric"
          />
          <Text style={CommonStyles.totalText}>
            Total Salary: {currencySymbol}
            {parseFloat(salary || 0).toFixed(2)}
          </Text>
        </View>

        <View style={CommonStyles.thinLine} />

        <View style={styles.section}>
          <Text style={CommonStyles.sectionHeader}>EXPENSES</Text>
          <EditableInputRow
            label="Daily Transportation Cost"
            value={dailyTransportCost}
            onChangeText={setDailyTransportCost}
            keyboardType="numeric"
          />
          <EditableInputRow
            label="Daily Lunch Cost"
            value={dailyLunchCost}
            onChangeText={setDailyLunchCost}
            keyboardType="numeric"
          />
          <EditableInputRow
            label="Work Days Monthly"
            value={workDaysMonthly}
            onChangeText={setWorkDaysMonthly}
            keyboardType="numeric"
          />
          <Text style={styles.calculatedValue}>
            Total Monthly Daily Expenses: {currencySymbol}
            {(
              (parseFloat(dailyTransportCost || 0) +
                parseFloat(dailyLunchCost || 0)) *
              parseFloat(workDaysMonthly || 0)
            ).toFixed(2)}
          </Text>

          <Text style={[styles.subHeader, { marginTop: 20 }]}>
            Other Monthly Expenses:
          </Text>
          {otherExpenses.map((exp, index) => (
            <View key={exp.id}>
              <EditableInputRow
                label={exp.name || `Other Expense ${index + 1}`}
                value={exp.amount}
                onChangeText={(text) => handleOtherExpenseChange(exp.id, text)}
                keyboardType="numeric"
              />
            </View>
          ))}
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={addOtherExpense}
          >
            <Text style={styles.addMoreButtonText}>+ Add Other Expense</Text>
          </TouchableOpacity>
          <Text style={CommonStyles.totalText}>
            Total Expenses: {currencySymbol}
            {calculateTotalExpenses().toFixed(2)}
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
  calculatedValue: {
    fontSize: 15,
    marginTop: 5,
    textAlign: "right",
    fontWeight: "bold",
    color: "#0056b3",
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
  subHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#555",
  },
});