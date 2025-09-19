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

// Helper component for editable input rows
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

export default function TraderAccountSheet() {
  const { sheetId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [sheetTitle, setSheetTitle] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₦");

  const isExistingSheet = !!sheetId;

  // Load existing data or set initial state
  useEffect(() => {
    const fetchSheetData = async () => {
      if (!user) {
        Alert.alert("Error", "User not authenticated.");
        setLoading(false);
        return;
      }

      // Load currency symbol
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
          const docRef = doc(db, `users/${user.uid}/traderSheets`, sheetId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProducts(data.products || []);
            setGeneralExpenses(data.generalExpenses || []);
            setSheetTitle(data.title || "");
          } else {
            Alert.alert("Error", "Sheet not found.");
          }
        } catch (e) {
          console.error("Error fetching document:", e);
          Alert.alert("Error", "Failed to load sheet data.");
        }
      } else {
        setProducts([
          {
            id: Date.now().toString(),
            name: "",
            costPrice: "",
            sellingPrice: "",
            initialStock: "",
            quantitySold: "",
            lowStockThreshold: "5",
            currentStock: 0,
          },
        ]);
        setGeneralExpenses([
          { id: "light", name: "Light Bills", amount: "" },
          { id: "repairs", name: "Repairs", amount: "" },
          { id: "utility", name: "Utility Bills", amount: "" },
          { id: "wages", name: "Staff Wages", amount: "" },
        ]);
        setSheetTitle(`New Trader Sheet - ${new Date().toLocaleDateString()}`);
      }
      setLoading(false);
    };

    fetchSheetData();
  }, [sheetId, user]);

  const handleProductChange = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;

    // Convert to number for calculations
    const lowStockThreshold = parseFloat(
      newProducts[index].lowStockThreshold || 0
    );
    const initialStock = parseFloat(newProducts[index].initialStock || 0);

    // Update current stock and check for low stock
    if (field === "quantitySold" || field === "initialStock") {
      const remainingStock = initialStock - parseFloat(value || 0);
      newProducts[index].currentStock = remainingStock;

      if (
        remainingStock <= lowStockThreshold &&
        remainingStock >= 0 &&
        parseFloat(value || 0) > 0
      ) {
        Alert.alert(
          "Low Stock Alert! 🚨",
          `'${newProducts[index].name}' is now at ${remainingStock} units. Consider reordering soon.`
        );
      } else if (remainingStock < 0) {
        Alert.alert(
          "Stock Error",
          `You are trying to sell more '${
            newProducts[index].name
          }' than available. Current stock: ${initialStock}. Quantity sold: ${parseFloat(
            value || 0
          )}.`
        );
      }
    }
    setProducts(newProducts);
  };

  const handleGeneralExpenseChange = (id, value) => {
    const newExpenses = generalExpenses.map((exp) =>
      exp.id === id ? { ...exp, amount: value } : exp
    );
    setGeneralExpenses(newExpenses);
  };

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now().toString(),
        name: "",
        costPrice: "",
        sellingPrice: "",
        initialStock: "",
        quantitySold: "",
        lowStockThreshold: "5",
        currentStock: 0,
      },
    ]);
  };

  const calculateTotalExpenses = () => {
    let productExpenses = products.reduce((sum, p) => {
      const cost = parseFloat(p.costPrice || 0);
      const qty = parseFloat(p.quantitySold || 0);
      return sum + cost * qty;
    }, 0);

    let generalExp = generalExpenses.reduce((sum, exp) => {
      return sum + parseFloat(exp.amount || 0);
    }, 0);

    return productExpenses + generalExp;
  };

  const calculateTotalSales = () => {
    return products.reduce((sum, p) => {
      const price = parseFloat(p.sellingPrice || 0);
      const qty = parseFloat(p.quantitySold || 0);
      return sum + price * qty;
    }, 0);
  };

  const handleSaveOrSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to save data.");
      return;
    }

    const totalExpenses = calculateTotalExpenses();
    const totalSales = calculateTotalSales();
    const difference = totalSales - totalExpenses;

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
      type: "trader",
      products: products.map((p) => ({
        name: p.name,
        costPrice: parseFloat(p.costPrice || 0),
        sellingPrice: parseFloat(p.sellingPrice || 0),
        initialStock: parseFloat(p.initialStock || 0),
        quantitySold: parseFloat(p.quantitySold || 0),
        lowStockThreshold: parseFloat(p.lowStockThreshold || 0),
        currentStock: p.currentStock,
      })),
      generalExpenses: generalExpenses.map((exp) => ({
        name: exp.name,
        amount: parseFloat(exp.amount || 0),
      })),
      totalSales: totalSales,
      totalExpenses: totalExpenses,
      profitOrLoss: difference,
      timestamp: serverTimestamp(),
    };

    try {
      if (isExistingSheet) {
        const docRef = doc(db, `users/${user.uid}/traderSheets`, sheetId);
        await updateDoc(docRef, sheetData);
        Alert.alert("Success", "Sheet updated successfully!");
      } else {
        await addDoc(
          collection(db, `users/${user.uid}/traderSheets`),
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
          <Text style={styles.subHeader}>Product Costs:</Text>
          {products.map((product, index) => (
            <View key={product.id} style={styles.productInputGroup}>
              <EditableInputRow
                label="Product Name"
                value={product.name}
                onChangeText={(text) =>
                  handleProductChange(index, "name", text)
                }
              />
              <EditableInputRow
                label="Cost Price (Unit)"
                value={product.costPrice}
                onChangeText={(text) =>
                  handleProductChange(index, "costPrice", text)
                }
                keyboardType="numeric"
              />
              <EditableInputRow
                label="Initial Stock"
                value={product.initialStock}
                onChangeText={(text) =>
                  handleProductChange(index, "initialStock", text)
                }
                keyboardType="numeric"
              />
              <EditableInputRow
                label="Quantity Sold"
                value={product.quantitySold}
                onChangeText={(text) =>
                  handleProductChange(index, "quantitySold", text)
                }
                keyboardType="numeric"
              />
              <EditableInputRow
                label="Low Stock Threshold"
                value={product.lowStockThreshold}
                onChangeText={(text) =>
                  handleProductChange(index, "lowStockThreshold", text)
                }
                keyboardType="numeric"
              />
              {product.initialStock && product.quantitySold && (
                <Text style={styles.currentStockText}>
                  Current Stock:{" "}
                  {product.currentStock !== undefined
                    ? product.currentStock
                    : "N/A"}
                </Text>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addMoreButton} onPress={addProduct}>
            <Text style={styles.addMoreButtonText}>+ Add Product</Text>
          </TouchableOpacity>

          <Text style={[styles.subHeader, { marginTop: 20 }]}>
            General Expenses:
          </Text>
          {generalExpenses.map((exp) => (
            <EditableInputRow
              key={exp.id}
              label={exp.name}
              value={exp.amount}
              onChangeText={(text) => handleGeneralExpenseChange(exp.id, text)}
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
          <Text style={CommonStyles.sectionHeader}>SALES</Text>
          <Text style={styles.subHeader}>Product Sales:</Text>
          {products.map((product, index) => (
            <View key={product.id} style={styles.productInputGroup}>
              <Text style={CommonStyles.editableTextLabel}>
                {product.name || `Product ${index + 1}`}
              </Text>
              <EditableInputRow
                label="Selling Price (Unit)"
                value={product.sellingPrice}
                onChangeText={(text) =>
                  handleProductChange(index, "sellingPrice", text)
                }
                keyboardType="numeric"
              />
              <Text style={styles.calculatedValue}>
                Total Sales for {product.name || "Product"}: {currencySymbol}
                {(
                  parseFloat(product.sellingPrice || 0) *
                  parseFloat(product.quantitySold || 0)
                ).toFixed(2)}
              </Text>
            </View>
          ))}
          <Text style={CommonStyles.totalText}>
            Total Sales: {currencySymbol}
            {calculateTotalSales().toFixed(2)}
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
  subHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#555",
  },
  productInputGroup: {
    backgroundColor: "#e6f7ff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#b3e0ff",
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
  currentStockText: {
    fontSize: 14,
    color: "red",
    marginTop: 5,
    fontWeight: "bold",
  },
});