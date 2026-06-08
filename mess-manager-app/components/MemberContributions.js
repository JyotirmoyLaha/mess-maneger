import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Colors, Shadows } from './Theme';
import { Users, Plus, Edit2, User, Wallet } from 'lucide-react-native';

const MESS_MEMBERS = [
  { id: 'jyotirmoy', name: 'Jyotirmoy' },
  { id: 'soumik', name: 'Soumik' },
  { id: 'subhajit', name: 'Subhajit' },
  { id: 'debdeep', name: 'Debdeep' },
  { id: 'siddarth', name: 'Siddarth' }
];

export default function MemberContributions({
  memberFunds = {},
  isAdmin = false,
  onAddMoney,
  onEditMoney
}) {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Form states
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  
  const [editMemberId, setEditMemberId] = useState('');
  const [editMemberName, setEditMemberName] = useState('');
  const [editTotal, setEditTotal] = useState('');

  const colors = [
    { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', icon: Colors.emerald, badge: 'rgba(16, 185, 129, 0.12)' },
    { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', icon: Colors.red, badge: 'rgba(239, 68, 68, 0.12)' },
    { bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.25)', icon: Colors.teal, badge: 'rgba(5, 150, 105, 0.12)' },
    { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.25)', icon: Colors.red, badge: 'rgba(244, 63, 94, 0.12)' },
    { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', icon: Colors.emerald, badge: 'rgba(16, 185, 129, 0.12)' }
  ];

  let grandTotal = 0;

  const handleAddSubmit = () => {
    const amount = parseFloat(addAmount);
    if (!selectedMemberId) {
      Alert.alert('Error', 'Please select a member.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid contribution amount.');
      return;
    }
    onAddMoney(selectedMemberId, amount);
    // Reset and close
    setSelectedMemberId('');
    setAddAmount('');
    setAddModalVisible(false);
  };

  const handleEditSubmit = () => {
    const total = parseFloat(editTotal);
    if (isNaN(total) || total < 0) {
      Alert.alert('Error', 'Please enter a valid total amount.');
      return;
    }
    onEditMoney(editMemberId, total);
    // Reset and close
    setEditMemberId('');
    setEditMemberName('');
    setEditTotal('');
    setEditModalVisible(false);
  };

  const openEditModal = (memberId, memberName, currentTotal) => {
    setEditMemberId(memberId);
    setEditMemberName(memberName);
    setEditTotal(String(currentTotal));
    setEditModalVisible(true);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBg}>
            <Users size={18} color={Colors.emerald} />
          </View>
          <Text style={styles.headerTitle}>Member Contributions</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Plus size={14} color="#ffffff" strokeWidth={3} />
          <Text style={styles.addButtonText}>ADD MONEY</Text>
        </TouchableOpacity>
      </View>

      {/* Members List */}
      <View style={styles.list}>
        {MESS_MEMBERS.map((member, idx) => {
          const memberData = memberFunds[member.id] || { totalMoney: 0, contributions: [] };
          const total = memberData.totalMoney || 0;
          grandTotal += total;
          const contributionCount = (memberData.contributions || []).length;
          const color = colors[idx % colors.length];

          return (
            <View key={member.id} style={styles.item}>
              <View style={styles.itemLeft}>
                <View style={[styles.memberIconBg, { backgroundColor: color.bg, borderColor: color.border }]}>
                  <User size={16} color={color.icon} />
                </View>
                <View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberCount}>
                    {contributionCount} contribution{contributionCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.itemRight}>
                <View style={[styles.badge, { backgroundColor: color.bg, borderColor: color.border }]}>
                  <Text style={[styles.badgeText, { color: color.icon }]}>
                    ₹{total.toLocaleString('en-IN')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditModal(member.id, member.name, total)}
                  activeOpacity={0.6}
                >
                  <Edit2 size={14} color={Colors.emerald} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Grand Total Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.footerIconBg}>
            <Text style={styles.sigma}>Σ</Text>
          </View>
          <Text style={styles.footerTitle}>Grand Total</Text>
        </View>
        <Text style={styles.footerValue}>
          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Add Money Modal */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Wallet size={28} color={Colors.emerald} />
            </View>
            <Text style={styles.modalTitle}>Add Money</Text>
            <Text style={styles.modalDesc}>Add contribution for a member</Text>

            {/* Member Selector */}
            <Text style={styles.label}>SELECT MEMBER</Text>
            <View style={styles.selectContainer}>
              {MESS_MEMBERS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.selectItem,
                    selectedMemberId === m.id && styles.selectItemSelected,
                  ]}
                  onPress={() => setSelectedMemberId(m.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.selectText,
                      selectedMemberId === m.id && styles.selectTextSelected,
                    ]}
                  >
                    {m.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount Input */}
            <Text style={styles.label}>AMOUNT (₹)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={addAmount}
                onChangeText={setAddAmount}
              />
            </View>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddSubmit}
              >
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Money Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Edit2 size={24} color={Colors.emerald} />
            </View>
            <Text style={styles.modalTitle}>Edit Contribution</Text>
            <Text style={styles.modalDesc}>Update total for {editMemberName}</Text>

            {/* Total Input */}
            <Text style={styles.label}>TOTAL AMOUNT (₹)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                value={editTotal}
                onChangeText={setEditTotal}
              />
            </View>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.emerald }]}
                onPress={handleEditSubmit}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.emerald,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    ...Shadows.sm,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  list: {
    paddingVertical: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberIconBg: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 12,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sigma: {
    color: Colors.textSecondary,
    fontWeight: '800',
    fontSize: 13,
  },
  footerTitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  footerValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    ...Shadows.lg,
  },
  modalIconBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#1e293b',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalDesc: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 20,
  },
  label: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 8,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  selectItem: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectItemSelected: {
    backgroundColor: Colors.emerald,
    borderColor: Colors.emerald,
  },
  selectText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  selectTextSelected: {
    color: '#ffffff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 20,
  },
  currencySymbol: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#1e293b',
    fontSize: 18,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.emerald,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.sm,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
